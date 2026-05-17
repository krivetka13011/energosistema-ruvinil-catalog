import catalogData from "../data/catalog.json";
import type { CatalogCategory, CatalogPayload, CatalogProduct } from "../types/catalog";

export const catalog = catalogData as CatalogPayload;

/** Основное изображение товара: поле image или первый URL из images[]. */
export function productPrimaryImage(p: CatalogProduct): string {
  const main = p.image?.trim();
  if (main) return main;
  const fromGallery = p.images?.map((u) => u?.trim()).find(Boolean);
  return fromGallery ?? "";
}

/** Превью раздела: из категории или первое фото среди товаров в поддереве. */
export function categoryRepresentativeImage(
  categories: CatalogCategory[],
  products: CatalogProduct[],
  categoryPathname: string,
): string {
  const norm = normalizePath(categoryPathname);
  const cat = categories.find((c) => normalizePath(c.pathname) === norm);
  const fromCat = cat?.image?.trim();
  if (fromCat) return fromCat;
  for (const p of descendantProducts(products, categoryPathname)) {
    const img = productPrimaryImage(p);
    if (img) return img;
  }
  return "";
}

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

/** Порядок позиций как в листинге на ruvinil.ru (страница пагинации → порядок на странице). */
export function sortProductsBySupplierListing(products: CatalogProduct[]) {
  return [...products].sort((a, b) => {
    const pa = a.listingPageIndex ?? 1;
    const pb = b.listingPageIndex ?? 1;
    if (pa !== pb) return pa - pb;
    return (a.listingPosition ?? 0) - (b.listingPosition ?? 0);
  });
}

/** Дочерние разделы: порядок как на сайте-источнике (sortHint), затем по названию. */
export function childCategoriesOrdered(categories: CatalogCategory[], parentPath: string | null) {
  const p = parentPath ? normalizePath(parentPath) : "/catalog/";
  return categories
    .filter((c) => normalizePath((c.parentPath ?? "/catalog/") as string) === p)
    .sort((a, b) => {
      const da = a.sortHint ?? 9999;
      const db = b.sortHint ?? 9999;
      if (da !== db) return da - db;
      return a.title.localeCompare(b.title, "ru");
    });
}
