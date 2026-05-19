/**
 * Для каждого раздела каталога обходит листинги ruvinil.ru и выставляет categoryPath
 * по странице листинга (дочерний раздел важнее родителя).
 *
 *   node scripts/sync-category-paths-from-supplier.mjs
 *
 * SYNC_DELAY_MS — пауза между запросами (по умолчанию 450).
 */
import fs from "fs/promises";
import path from "path";

import { normalizeCatalogPath, pickMoreSpecificCategoryPath } from "../scraper/category-path.mjs";
import { BASE, extractListingProducts, extractPaginationUrls } from "../scraper/listing-html.mjs";

const UA =
  "Mozilla/5.0 (compatible; RetailCatalogBot/1.0; +mailto:zakaz@en-msk.ru) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const DELAY_MS = Number(process.env.SYNC_DELAY_MS ?? 450);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function canonProductUrl(href) {
  try {
    const u = new URL(href);
    u.hash = "";
    let p = u.pathname.replace(/\/{2,}/g, "/");
    if (!p.endsWith("/")) p += "/";
    u.pathname = p;
    return u.href;
  } catch {
    return href;
  }
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
  return Buffer.from(await res.arrayBuffer()).toString("utf8");
}

async function main() {
  const catalogPath = path.resolve("src/data/catalog.json");
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const { categories, products } = catalog;

  const sorted = [...categories].sort((a, b) => b.pathname.length - a.pathname.length);
  const byUrl = new Map(products.map((p) => [canonProductUrl(p.url), p]));

  console.error(`[sync-category-paths] Разделов: ${sorted.length}, товаров: ${products.length}`);

  let pages = 0;
  let cardHits = 0;
  let pathUpdates = 0;

  for (let i = 0; i < sorted.length; i++) {
    const cat = sorted[i];
    const targetPath = normalizeCatalogPath(cat.pathname);
    if (!targetPath || targetPath === "/catalog/") continue;

    const queue = [new URL(cat.pathname, BASE).href.split("#")[0]];
    const visited = new Set();

    while (queue.length) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);

      await sleep(DELAY_MS);
      let html;
      try {
        html = await fetchHtml(url);
      } catch (e) {
        console.error(`[sync-category-paths] ${cat.title}: ${url} — ${e.message}`);
        continue;
      }
      pages += 1;

      for (const p of extractPaginationUrls(html, url)) {
        if (!visited.has(p)) queue.push(p);
      }

      for (const item of extractListingProducts(html, url)) {
        const row = byUrl.get(canonProductUrl(item.url));
        if (!row) continue;
        cardHits += 1;
        const prev = row.categoryPath;
        const chosen = pickMoreSpecificCategoryPath(categories, prev, targetPath);
        if (chosen !== prev) pathUpdates += 1;
        row.categoryPath = chosen;
        if (chosen === targetPath) {
          row.listingPage = item.listingPage ?? url;
          row.listingPageIndex = item.listingPageIndex;
          row.listingPosition = item.listingPosition;
        }
      }
    }

    if ((i + 1) % 25 === 0) {
      console.error(`… разделов ${i + 1}/${sorted.length}, страниц ${pages}, обновлений пути ${pathUpdates}`);
    }
  }

  await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.error(
    `[sync-category-paths] Готово. Страниц: ${pages}, карточек на листингах: ${cardHits}, смен categoryPath: ${pathUpdates}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
