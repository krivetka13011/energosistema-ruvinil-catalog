/**
 * Восстанавливает properties["Артикул"] по странице товара для позиций без артикула
 * (раньше терялся при enrich из‑за подмены свойств целиком).
 *
 *   node scripts/backfill-articles.mjs
 *
 * После этого имеет смысл снова выполнить merge-price-list с прайсом Excel.
 */
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";

const BASE = "https://www.ruvinil.ru";
const UA =
  "Mozilla/5.0 (compatible; RetailCatalogBot/1.0; +mailto:zakaz@en-msk.ru) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const DELAY_MS = Number(process.env.BACKFILL_DELAY_MS ?? 450);
const MAX_ITEMS_RAW = process.env.BACKFILL_MAX;
const MAX_ITEMS =
  MAX_ITEMS_RAW === undefined || MAX_ITEMS_RAW === "" ? Number.POSITIVE_INFINITY : Number(MAX_ITEMS_RAW);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ru-RU,ru;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("utf8");
}

function extractArticle(html) {
  const $ = cheerio.load(html);
  let v = $(".article-property-custom .product-main-property-value").first().text().trim();
  if (!v) v = $(".product-main-property.article-property-custom .product-main-property-value").first().text().trim();
  return v || "";
}

async function main() {
  const catalogPath = path.resolve("src/data/catalog.json");
  const raw = await fs.readFile(catalogPath, "utf8");
  const catalog = JSON.parse(raw);
  const targets = catalog.products.filter((p) => {
    const sku = p.properties?.["Артикул"]?.trim?.();
    return !sku && p.url?.includes("/catalog/");
  });
  console.error(`[backfill-articles] Без артикула: ${targets.length}, пауза ${DELAY_MS} мс между запросами`);
  let ok = 0;
  let fail = 0;
  let processed = 0;
  for (const p of targets) {
    if (processed >= MAX_ITEMS) break;
    processed += 1;
    await sleep(DELAY_MS);
    try {
      const html = await fetchHtml(p.url);
      const art = extractArticle(html);
      if (!art) {
        fail += 1;
        console.error(`… ${processed}/${targets.length} нет блока артикула: ${p.url}`);
        continue;
      }
      if (!p.properties) p.properties = {};
      p.properties["Артикул"] = art;
      ok += 1;
      if (ok % 25 === 0) console.error(`… заполнено артикулов: ${ok}`);
    } catch (e) {
      fail += 1;
      console.error(`… ${processed}/${targets.length} ошибка ${p.url}: ${e.message}`);
    }
  }
  await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.error(`[backfill-articles] Готово. Заполнено: ${ok}, без результата/ошибки: ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
