import catalogData from "../data/catalog.json";
import type { CatalogCategory, CatalogPayload, CatalogProduct } from "../types/catalog";

export const catalog = catalogData as CatalogPayload;

/** Children of a category path (normalized with slashes). */
export function childCategories(categories: CatalogCategory[], parentPath: string | null) {
  const p = parentPath ? normalizePath(parentPath) : "/catalog/";
  return categories
    .filter((c) => normalizePath((c.parentPath ?? "/catalog/") as string) === p)
    .sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

export function normalizePath(pathname: string) {
  if (!pathname.endsWith("/")) return `${pathname}/`;
  return pathname.replace(/\/{2,}/g, "/");
}

export function productsInCategory(products: CatalogProduct[], categoryPath: string) {
  const cp = normalizePath(categoryPath);
  return products.filter((p) => normalizePath(p.categoryPath) === cp);
}

export function descendantProducts(products: CatalogProduct[], categoryPath: string) {
  const prefix = normalizePath(categoryPath);
  return products.filter((p) => normalizePath(p.categoryPath).startsWith(prefix));
}
