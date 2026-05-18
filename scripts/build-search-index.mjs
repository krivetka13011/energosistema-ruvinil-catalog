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

const items = catalog.products.map((p) => {
  const sku = (p.properties && p.properties["Артикул"]) || "";
  const propsBlob = Object.entries(p.properties || {})
    .map(([k, v]) => `${k} ${v}`)
    .join(" ");
  const cp = normalizePathname(p.categoryPath);
  const cat = catalog.categories.find((c) => normalizePathname(c.pathname) === cp);
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

const pricesPath = path.resolve("public/cart-prices.json");
/** @type {Record<string, { u: number; d: string }>} */
const prices = {};
for (const p of catalog.products) {
  const u = catalogUnitPriceRub(p);
  if (u == null) continue;
  prices[p.slug] = { u, d: catalogPriceLabelForCart(p) };
}

fs.mkdirSync(path.dirname(pricesPath), { recursive: true });
fs.writeFileSync(
  pricesPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), count: Object.keys(prices).length, prices }),
  "utf8",
);
console.error(`[cart-prices] ${Object.keys(prices).length} slugs → ${pricesPath}`);
