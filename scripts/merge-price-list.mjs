/**
 * Сливает оптовые цены из прайс-листа Excel ЗАО «РУВИНИЛ» в src/data/catalog.json.
 *
 * Использование:
 *   node scripts/merge-price-list.mjs "C:\\Users\\User\\Downloads\\price_list.xlsx"
 *
 * Совпадение по полю properties["Артикул"]. Строки прайса без карточки на сайте добавляются в
 * раздел «Позиции только из прайс-листа» с пустым image (на витрине — «Нет фото»).
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import xlsx from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(ROOT, "src", "data", "catalog.json");

const PRICE_SHEET = "ЗАО РУВИНИЛ (прайс-лист)";

function skuSlug(sku) {
  return Buffer.from(String(sku), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
    .slice(0, 96);
}

function parsePriceRows(wb) {
  const sheet = wb.Sheets[PRICE_SHEET];
  if (!sheet) {
    throw new Error(`Лист «${PRICE_SHEET}» не найден. Доступно: ${wb.SheetNames.join(", ")}`);
  }
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  /** @type {Map<string, { name: string, priceRub: number }>} */
  const map = new Map();
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    if (r[2] === "Артикул") continue;
    const rawArt = r[2];
    if (rawArt === "" || rawArt === undefined || rawArt === null) continue;
    const art = String(rawArt).trim();
    if (!art) continue;
    const name = String(r[3] ?? "").trim();
    const rawPrice = r[7];
    let priceNum =
      typeof rawPrice === "number"
        ? rawPrice
        : Number.parseFloat(String(rawPrice).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(priceNum)) continue;
    const priceRub = Math.round(priceNum * 100) / 100;
    map.set(art, { name, priceRub });
  }
  return map;
}

async function main() {
  const xlsxPath = process.argv[2];
  if (!xlsxPath) {
    console.error('Укажите путь к .xlsx: node scripts/merge-price-list.mjs "C:\\path\\price_list.xlsx"');
    process.exit(1);
  }

  const wb = xlsx.readFile(xlsxPath);
  const bySku = parsePriceRows(wb);

  const raw = await fs.readFile(CATALOG_PATH, "utf8");
  /** @type {{ categories: any[]; products: any[]; generatedAt: string }} */
  const catalog = JSON.parse(raw);

  let matched = 0;
  const catalogSkus = new Set();
  for (const p of catalog.products) {
    const sku = p.properties?.["Артикул"]?.trim?.();
    if (!sku) continue;
    catalogSkus.add(sku);
    const row = bySku.get(sku);
    if (!row) continue;
    matched += 1;
    p.properties["Опт. прайс, руб."] = String(row.priceRub);
  }

  const virtPath = "/catalog/price-list-import/";
  const hasVirt = catalog.categories.some((c) => c.pathname === virtPath);
  if (!hasVirt) {
    catalog.categories.push({
      pathname: virtPath,
      title: "Позиции только из прайс-листа",
      parentPath: "/catalog/",
      slug: "price-list-import",
      sortHint: 9999,
    });
  }

  let added = 0;
  for (const [sku, row] of bySku) {
    if (catalogSkus.has(sku)) continue;
    const slug = `price-list__${skuSlug(sku)}`;
    catalog.products.push({
      url: "https://www.ruvinil.ru/catalog/",
      slug,
      supplierPath: `/price-list/${encodeURIComponent(sku)}/`,
      title: row.name || `Артикул ${sku}`,
      image: "",
      images: [],
      properties: {
        Артикул: sku,
        "Опт. прайс, руб.": String(row.priceRub),
        Источник: "Прайс-лист (нет карточки на сайте)",
      },
      priceHint: `${row.priceRub} ₽ (опт., прайс)`,
      availability: "",
      listingPage: "",
      listingPageIndex: 1,
      listingPosition: added,
      categoryPath: virtPath,
      descriptionHtml:
        "<p>Позиция добавлена из прайс-листа поставщика. Фото на сайте производителя может отсутствовать.</p>",
    });
    catalogSkus.add(sku);
    added += 1;
  }

  catalog.generatedAt = new Date().toISOString();
  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf8");

  console.error(
    `[merge-price-list] Прайс: ${bySku.size} строк. Совпало с каталогом: ${matched}. Добавлено без сайта: ${added}. Записано ${CATALOG_PATH}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
