import fs from "fs/promises";
import path from "path";

const target = path.resolve("src/data/catalog.json");

function normalizePath(pathname) {
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return withSlash.replace(/\/{2,}/g, "/");
}

function inferCategoryPath(productUrl) {
  try {
    const pathname = new URL(productUrl).pathname.replace(/\/{2,}/g, "/");
    const trimmed = pathname.replace(/\/+$/, "");
    const slash = trimmed.lastIndexOf("/");
    if (slash <= 0) return null;
    const folder = `${trimmed.slice(0, slash)}/`;
    if (!folder.startsWith("/catalog") || folder === "/catalog/") return null;
    return normalizePath(folder);
  } catch {
    return null;
  }
}

async function main() {
  const raw = await fs.readFile(target, "utf8");
  const catalog = JSON.parse(raw);
  let changed = 0;
  for (const p of catalog.products ?? []) {
    if (!p.url) continue;
    const inferred = inferCategoryPath(p.url);
    if (!inferred) continue;
    const prev = normalizePath(p.categoryPath ?? "");
    if (prev !== inferred) {
      p.categoryPath = inferred;
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
