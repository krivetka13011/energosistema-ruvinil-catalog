/**
 * Перепривязывает categoryPath по листингам поставщика для выбранных разделов
 * (товары, ошибочно оставшиеся у родителя вроде ОКЛ).
 *
 *   node scripts/reassign-listing-categories.mjs
 *
 * REASSIGN_PATHS — пути через запятую, по умолчанию кабель-каналы Рувинил и коробки HF.
 */
import fs from "fs/promises";
import path from "path";

import { normalizeCatalogPath } from "../scraper/category-path.mjs";
import { BASE, extractListingProducts, extractPaginationUrls } from "../scraper/listing-html.mjs";

const UA =
  "Mozilla/5.0 (compatible; RetailCatalogBot/1.0; +mailto:zakaz@en-msk.ru) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const DELAY_MS = Number(process.env.REASSIGN_DELAY_MS ?? 450);

const DEFAULT_PATHS = [
  "/catalog/kabel-kanaly-ruvinil/",
  "/catalog/elektromontazhnye-korobki-tuso-ne-rasprostranyayushchie-gorenie-hf/",
];

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
  const rawPaths = process.env.REASSIGN_PATHS;
  const paths = rawPaths
    ? rawPaths.split(",").map((p) => normalizeCatalogPath(p.trim())).filter(Boolean)
    : DEFAULT_PATHS;

  const catalogPath = path.resolve("src/data/catalog.json");
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const byUrl = new Map(catalog.products.map((p) => [canonProductUrl(p.url), p]));

  let reassigned = 0;

  for (const targetPath of paths) {
    if (!targetPath) continue;
    const rel = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
    const startUrl = new URL(rel, BASE).href.split("#")[0];
    const queue = [startUrl];
    const visited = new Set();
    let hits = 0;

    while (queue.length) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);

      await sleep(DELAY_MS);
      const html = await fetchHtml(url);
      for (const p of extractPaginationUrls(html, url)) {
        if (!visited.has(p)) queue.push(p);
      }

      for (const item of extractListingProducts(html, url)) {
        const row = byUrl.get(canonProductUrl(item.url));
        if (!row) continue;
        hits += 1;
        const prev = row.categoryPath;
        row.categoryPath = targetPath;
        row.listingPage = item.listingPage ?? url;
        if (prev !== targetPath) reassigned += 1;
      }
    }

    console.error(`[reassign-listing] ${targetPath}: карточек на листингах ${hits}`);
  }

  await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.error(`[reassign-listing] Готово. Смена categoryPath: ${reassigned}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
