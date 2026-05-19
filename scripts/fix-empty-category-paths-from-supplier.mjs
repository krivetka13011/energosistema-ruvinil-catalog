/**
 * Для категорий без ни одного товара в поддереве подтягивает листинги с сайта поставщика
 * и привязывает уже известные по URL товары к разделу листинга (глубже или равно текущему пути).
 *
 *   node scripts/fix-empty-category-paths-from-supplier.mjs
 *
 * Пауза: FIX_EMPTY_DELAY_MS (по умолчанию 450).
 * Лимит категорий (отладка): FIX_EMPTY_MAX_CATEGORIES=N
 */
import fs from "fs/promises";
import path from "path";

import { normalizeCatalogPath } from "../scraper/category-path.mjs";
import { BASE, extractListingProducts, extractPaginationUrls } from "../scraper/listing-html.mjs";

const UA =
  "Mozilla/5.0 (compatible; RetailCatalogBot/1.0; +mailto:zakaz@en-msk.ru) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const DELAY_MS = Number(process.env.FIX_EMPTY_DELAY_MS ?? 450);
const MAX_CAT_RAW = process.env.FIX_EMPTY_MAX_CATEGORIES;
const MAX_CATEGORIES =
  MAX_CAT_RAW === undefined || MAX_CAT_RAW === "" ? Number.POSITIVE_INFINITY : Number(MAX_CAT_RAW);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Единый ключ для сопоставления с полем url в каталоге */
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

function normalizePath(pathname) {
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return withSlash.replace(/\/{2,}/g, "/");
}

function descendantPaths(categories, rootPathname) {
  const normRoot = normalizePath(rootPathname);
  const byParent = new Map();
  for (const c of categories) {
    const parent = normalizePath((c.parentPath ?? "/catalog/") || "/catalog/");
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(c);
  }
  const out = new Set();
  const stack = [normRoot];
  while (stack.length) {
    const cur = stack.pop();
    if (out.has(cur)) continue;
    out.add(cur);
    for (const child of byParent.get(cur) ?? []) {
      stack.push(normalizePath(child.pathname));
    }
  }
  return out;
}

function productsInTree(products, categories, rootPath) {
  const paths = descendantPaths(categories, rootPath);
  return products.filter((p) => paths.has(normalizePath(p.categoryPath)));
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

async function main() {
  const catalogPath = path.resolve("src/data/catalog.json");
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const { categories, products } = catalog;

  const emptyCats = categories
    .filter((c) => productsInTree(products, categories, c.pathname).length === 0)
    .sort((a, b) => b.pathname.length - a.pathname.length);
  const slice = emptyCats.slice(0, MAX_CATEGORIES);

  console.error(
    `[fix-empty-categories] Пустых разделов (поддерево): ${emptyCats.length}, обрабатываем: ${slice.length}`,
  );

  const byUrl = new Map();
  for (const p of products) {
    byUrl.set(canonProductUrl(p.url), p);
  }
  let reassigned = 0;

  for (const cat of slice) {
    const targetPath = normalizeCatalogPath(cat.pathname);
    if (!targetPath) continue;

    let rel = cat.pathname.replace(/\/{2,}/g, "/");
    if (!rel.startsWith("/")) rel = `/${rel}`;
    if (!rel.endsWith("/")) rel = `${rel}/`;
    /** @type {string[]} */
    const queue = [];
    try {
      queue.push(new URL(rel, BASE).href.split("#")[0]);
    } catch {
      console.error(`[fix-empty-categories] Пропуск неверного пути: ${cat.pathname}`);
      continue;
    }

    const visited = new Set();
    let pagesForCat = 0;
    let hitsOnListing = 0;

    while (queue.length) {
      const url = queue.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);

      await sleep(DELAY_MS);
      let html;
      try {
        html = await fetchHtml(url);
      } catch (e) {
        console.error(`[fix-empty-categories] ${cat.title}: ${url} — ${e.message}`);
        continue;
      }
      pagesForCat += 1;

      for (const p of extractPaginationUrls(html, url)) {
        if (!visited.has(p)) queue.push(p);
      }

      const found = extractListingProducts(html, url);
      if (found.length) hitsOnListing += found.length;

      for (const item of found) {
        const p = byUrl.get(canonProductUrl(item.url));
        if (!p) continue;
        const prevPath = p.categoryPath;
        p.categoryPath = targetPath;
        p.listingPage = item.listingPage ?? url;
        if (prevPath !== targetPath) reassigned += 1;
      }
    }

    console.error(
      `[fix-empty-categories] «${cat.title}»: страниц ${pagesForCat}, позиций на листингах ${hitsOnListing}`,
    );
  }

  await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.error(`[fix-empty-categories] Готово. Перепривязано записей (смена categoryPath): ${reassigned}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
