/** Утилиты пути категории в /catalog/… — общие для scrape и normalize. */

export function normalizeCatalogPath(pathname) {
  if (!pathname.startsWith("/catalog")) return null;
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return withSlash.replace(/\/{2,}/g, "/");
}

export function inferCategoryPathFromProductUrl(absProductUrl, fallbackListingPath) {
  try {
    const pathname = new URL(absProductUrl).pathname.replace(/\/{2,}/g, "/");
    const trimmed = pathname.replace(/\/+$/, "");
    const slash = trimmed.lastIndexOf("/");
    if (slash <= 0) return fallbackListingPath;
    const folder = `${trimmed.slice(0, slash)}/`;
    return normalizeCatalogPath(folder) ?? fallbackListingPath;
  } catch {
    return fallbackListingPath;
  }
}

export function catalogPathDepth(pathname) {
  const n = normalizeCatalogPath(pathname ?? "");
  if (!n) return 0;
  return n.replace(/\/+$/, "").split("/").filter(Boolean).length;
}

/**
 * @param {Map<string, { parentPath: string | null }> | Array<{ pathname: string, parentPath?: string | null }>} meta
 */
export function isCategoryDescendantOf(meta, descendantPath, ancestorPath) {
  const ancestor = normalizeCatalogPath(ancestorPath ?? "");
  const byPath = new Map();
  if (meta instanceof Map) {
    for (const [pathname, row] of meta) {
      byPath.set(normalizeCatalogPath(pathname) ?? "", row);
    }
  } else {
    for (const row of meta) {
      byPath.set(normalizeCatalogPath(row.pathname) ?? "", row);
    }
  }
  let cur = normalizeCatalogPath(descendantPath ?? "");
  while (cur && cur !== "/catalog/") {
    if (cur === ancestor) return true;
    const row = byPath.get(cur);
    const parent = row?.parentPath ? normalizeCatalogPath(row.parentPath) : null;
    if (!parent) break;
    cur = parent;
  }
  return false;
}

/**
 * Какой categoryPath оставить при дубле URL (листинги родителя и дочернего раздела).
 * @param {Map<string, { parentPath: string | null }> | Array<{ pathname: string, parentPath?: string | null }>} meta
 */
export function pickMoreSpecificCategoryPath(meta, pathA, pathB) {
  const a = normalizeCatalogPath(pathA ?? "") ?? "/catalog/";
  const b = normalizeCatalogPath(pathB ?? "") ?? "/catalog/";
  if (isCategoryDescendantOf(meta, b, a)) return b;
  if (isCategoryDescendantOf(meta, a, b)) return a;
  const da = catalogPathDepth(a);
  const db = catalogPathDepth(b);
  if (db !== da) return db > da ? b : a;
  return b.length >= a.length ? b : a;
}
