import fs from "fs";
import path from "path";

const catalogPath = path.resolve("src/data/catalog.json");
const outPath = path.resolve("public/search-index.json");

function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePathname(p) {
  if (!p) return "/catalog/";
  const x = p.endsWith("/") ? p : `${p}/`;
  return x.replace(/\/{2,}/g, "/");
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const categoryMap = new Map();
if (catalog.categories) {
  for (const c of catalog.categories) {
    categoryMap.set(normalizePathname(c.pathname), c);
  }
}

const items = catalog.products.map((p) => {
  const sku = (p.properties && p.properties["Артикул"]) || "";
  const propsBlob = Object.entries(p.properties ?? {})
    .map(([k, v]) => `${k} ${v}`)
    .join(" ");
  const cp = normalizePathname(p.categoryPath);
  const cat = categoryMap.get(cp);
  const catTitle = cat ? cat.title : "";
  const haystack = norm(`${p.title} ${sku} ${propsBlob} ${catTitle}`);
  return {
    slug: p.slug,
    title: p.title,
    sku,
    category: catTitle,
    haystack,
  };
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), count: items.length, items }),
  "utf8",
);
console.error(`[search-index] ${items.length} items → ${outPath}`);

/** Дублирует логику src/utils/price.ts — при изменении правил синхронизировать вручную. */
function parseFirstPositiveRub(text) {
  const trimmed = String(text).replace(/\u00a0/g, " ").trim();
  if (!trimmed) return null;
  const unified = trimmed.replace(/(\d)\s+(?=\d)/g, "$1");
  const m = unified.match(/\d+[.,]\d+|\d+/);
  if (!m) return null;
  const n = Number.parseFloat(m[0].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatRub(n) {
  const frac = Math.abs(n % 1) > 1e-9;
  return (
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: frac ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(n) + " ₽"
  );
}

function catalogUnitPriceRub(p) {
  const wholesale = (p.properties && String(p.properties["Опт. прайс, руб."] ?? "").trim()) || "";
  if (wholesale) {
    const n = parseFirstPositiveRub(wholesale);
    if (n != null) return n;
  }
  const hint = (p.priceHint && String(p.priceHint).trim()) || "";
  if (!hint) return null;
  return parseFirstPositiveRub(hint);
}

function catalogPriceLabelForCart(p) {
  const rub = catalogUnitPriceRub(p);
  const wholesale = (p.properties && String(p.properties["Опт. прайс, руб."] ?? "").trim()) || "";
  if (wholesale && rub != null) return `Опт: ${formatRub(rub)}`;
  if (p.priceHint && String(p.priceHint).trim()) return String(p.priceHint).trim();
  if (rub != null) return formatRub(rub);
  return "";
}

function parsePackQuantity(raw) {
  const s = String(raw).replace(/\u00a0/g, " ").trim();
  if (!s) return null;
  const mul = s.match(/^(\d+)\s*[xх*×]\s*(\d+)$/i);
  if (mul) {
    const a = Number.parseInt(mul[1], 10);
    const b = Number.parseInt(mul[2], 10);
    if (a > 0 && b > 0) return a * b;
  }
  const n = parseFirstPositiveRub(s);
  return n != null && n > 0 ? n : null;
}

function isPricePerMeterHint(hint) {
  const h = String(hint).toLowerCase().replace(/\u00a0/g, " ");
  return /руб\.?\s*\/\s*м/i.test(h) || /₽\s*\/\s*м/.test(h) || /rub\.?\s*\/\s*m/i.test(h);
}

function isPricePerPieceHint(hint) {
  const h = String(hint).toLowerCase().replace(/\u00a0/g, " ");
  return /руб\.?\s*\/\s*шт/i.test(h) || /₽\s*\/\s*шт/.test(h) || /rub\.?\s*\/\s*(шт|sht)/i.test(h);
}

function metersPerSaleUnit(p) {
  const props = p.properties ?? {};
  const keys = ["Длина в бухте, м", "Длина в бухте", "Длина бухты, м", "Длина, м", "Длина (м)"];
  for (const k of keys) {
    const raw = props[k]?.trim?.();
    if (!raw) continue;
    const cleaned = String(raw).replace(/\s*м\.?\s*$/i, "").trim();
    const n = parseFirstPositiveRub(cleaned);
    if (n != null && n > 0) return n;
  }
  const title = p.title || "";
  const m = title.match(/\((\d+(?:[.,]\d+)?)\s*м\)/i);
  if (m) {
    const n = Number.parseFloat(m[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  const endM = title.match(/(\d+(?:[.,]\d+)?)\s*м\s*$/i);
  if (endM) {
    const n = Number.parseFloat(endM[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function pieceLengthMeters(p) {
  const props = p.properties ?? {};
  for (const k of ["Кратность упаковки, м", "Длина отрезка, м", "Длина изделия, м"]) {
    const raw = props[k]?.trim?.();
    if (!raw) continue;
    const n = parseFirstPositiveRub(String(raw).replace(/\s*м\.?\s*$/i, ""));
    if (n != null && n > 0) return n;
  }
  const dimMm = (p.title || "").match(/(?:х|x)(\d+)\s*мм\b/i);
  if (dimMm) {
    const mm = Number.parseInt(dimMm[1], 10);
    if (mm >= 100) return mm / 1000;
  }
  return null;
}

function piecesPerSaleUnit(p) {
  const props = p.properties ?? {};
  for (const k of ["Количество в упаковке, шт.", "Кол-во в упаковке, шт.", "В упаковке"]) {
    const raw = props[k]?.trim?.();
    if (!raw) continue;
    const n = parsePackQuantity(raw);
    if (n != null && n > 0) return n;
  }
  const m = (p.title || "").match(/\(уп\.?\s*([^)]+?)\s*шт\.?\)/i);
  if (m) {
    const n = parsePackQuantity(m[1]);
    if (n != null && n > 0) return n;
  }
  return null;
}

function saleUnitMeterQty(p) {
  const props = p.properties ?? {};
  const coil = metersPerSaleUnit(p);
  if (coil != null) return coil;
  const packM = props["Количество в упаковке, м"]?.trim?.();
  if (packM) {
    const n = parseFirstPositiveRub(String(packM).replace(/\s*м\.?\s*$/i, ""));
    if (n != null && n > 0) return n;
  }
  const piece = pieceLengthMeters(p);
  const pcs = piecesPerSaleUnit(p);
  if (piece != null && pcs != null && pcs > 0) return Math.round(piece * pcs * 1000) / 1000;
  return null;
}

function roundRub(n) {
  return Math.round(n * 100) / 100;
}

function catalogCartUnitPriceRub(p) {
  const rate = catalogUnitPriceRub(p);
  if (rate == null) return null;
  const hint = (p.priceHint && String(p.priceHint).trim()) || "";
  if (hint && isPricePerMeterHint(hint)) {
    const meters = saleUnitMeterQty(p);
    if (meters == null) return null;
    return roundRub(rate * meters);
  }
  if (!hint || isPricePerPieceHint(hint)) {
    const pcs = piecesPerSaleUnit(p);
    if (pcs != null && pcs > 1) return roundRub(rate * pcs);
  }
  return roundRub(rate);
}

function catalogCartPriceLabelForCart(p) {
  const rate = catalogUnitPriceRub(p);
  if (rate == null) return catalogPriceLabelForCart(p);
  const hint = (p.priceHint && String(p.priceHint).trim()) || "";
  const wholesale = (p.properties && String(p.properties["Опт. прайс, руб."] ?? "").trim()) || "";
  if (hint && isPricePerMeterHint(hint)) {
    const meters = saleUnitMeterQty(p);
    const head = wholesale ? `Опт: ${formatRub(rate)}/м` : hint;
    if (meters == null) {
      return `${head} — не удалось определить метраж упаковки, сумму считайте вручную`;
    }
    const total = roundRub(rate * meters);
    return `${head} × ${String(meters).replace(".", ",")} м = ${formatRub(total)} за упаковку`;
  }
  if (!hint || isPricePerPieceHint(hint)) {
    const pcs = piecesPerSaleUnit(p);
    if (pcs != null && pcs > 1) {
      const head = wholesale ? `Опт: ${formatRub(rate)}/шт` : hint || `${formatRub(rate)}/шт`;
      const total = roundRub(rate * pcs);
      return `${head} × ${String(pcs).replace(".", ",")} шт = ${formatRub(total)} за упаковку`;
    }
  }
  return catalogPriceLabelForCart(p);
}

const pricesPath = path.resolve("public/cart-prices.json");
/** @type {Record<string, { u: number; d: string }>} */
const prices = {};
for (const p of catalog.products) {
  const u = catalogCartUnitPriceRub(p);
  if (u == null) continue;
  prices[p.slug] = { u, d: catalogCartPriceLabelForCart(p) };
}

fs.mkdirSync(path.dirname(pricesPath), { recursive: true });
fs.writeFileSync(
  pricesPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), count: Object.keys(prices).length, prices }),
  "utf8",
);
console.error(`[cart-prices] ${Object.keys(prices).length} slugs → ${pricesPath}`);
