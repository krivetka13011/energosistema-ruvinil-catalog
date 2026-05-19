import fs from "fs/promises";
import path from "path";

import {
  inferCategoryPathFromProductUrl,
  normalizeCatalogPath,
} from "../scraper/category-path.mjs";

const target = path.resolve("src/data/catalog.json");

function normalizePath(pathname) {
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return withSlash.replace(/\/{2,}/g, "/");
}

async function main() {
  const raw = await fs.readFile(target, "utf8");
  const catalog = JSON.parse(raw);
  let changed = 0;
  for (const p of catalog.products ?? []) {
    if (!p.url) continue;
    /** @type {string | null} */
    let next = null;
    if (p.listingPage) {
      try {
        next = normalizeCatalogPath(new URL(p.listingPage).pathname);
      } catch {
        next = null;
      }
    }
    if (!next) {
      const fallback = normalizeCatalogPath(p.categoryPath ?? "") ?? "/catalog/";
      next = inferCategoryPathFromProductUrl(p.url, fallback);
    }
    const prev = normalizePath(p.categoryPath ?? "");
    const nextNorm = normalizePath(next);
    if (prev !== nextNorm) {
      p.categoryPath = nextNorm;
      changed += 1;
    }
  }
  if (changed > 0) {
    await fs.writeFile(target, `${JSON.stringify(catalog, null, 2)}\n`);
    console.error(`[normalize-catalog-category-paths] Updated categoryPath for ${changed} products.`);
  } else {
    console.error("[normalize-catalog-category-paths] No changes.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
