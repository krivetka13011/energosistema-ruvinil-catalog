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
  for (const p of productsInCategoryTree(products, categories, categoryPathname)) {
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

const normalizePathCache = new Map<string, string>();

export function normalizePath(pathname: string) {
  const cached = normalizePathCache.get(pathname);
  if (cached !== undefined) return cached;

  let res: string;
  if (!pathname.endsWith("/")) {
    res = `${pathname}/`;
  } else {
    res = pathname.replace(/\/{2,}/g, "/");
  }

  normalizePathCache.set(pathname, res);
  return res;
}

/** Раздел листинга, с которого взята карточка (как на ruvinil.ru). */
export function listingCategoryPath(product: CatalogProduct): string | null {
  if (!product.listingPage) return null;
  try {
    return normalizePath(new URL(product.listingPage).pathname);
  } catch {
    return null;
  }
}

export function productsInCategory(products: CatalogProduct[], categoryPath: string) {
  const cp = normalizePath(categoryPath);
  return products.filter((p) => {
    const assigned = normalizePath(p.categoryPath);
    const listed = listingCategoryPath(p);
    return assigned === cp || listed === cp;
  });
}

/** Pathname всех узлов поддерева (корень включительно) по parentPath — как в меню поставщика. */
export function descendantCategoryPathSet(categories: CatalogCategory[], rootPathname: string): Set<string> {
  const normRoot = normalizePath(rootPathname);
  const byParent = new Map<string, CatalogCategory[]>();
  for (const c of categories) {
    const parent = normalizePath((c.parentPath ?? "/catalog/") as string);
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(c);
  }
  const out = new Set<string>();
  const stack = [normRoot];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const child of byParent.get(cur) ?? []) {
      stack.push(normalizePath(child.pathname));
    }
  }
  return out;
}

/** Товары узла и всех вложенных разделов (не по префиксу URL — у поставщика дочерние пути не всегда «подстрока» родителя). */
export function productsInCategoryTree(
  products: CatalogProduct[],
  categories: CatalogCategory[],
  rootPathname: string,
): CatalogProduct[] {
  const paths = descendantCategoryPathSet(categories, rootPathname);
  return products.filter((p) => {
    const assigned = normalizePath(p.categoryPath);
    const listed = listingCategoryPath(p);
    return paths.has(assigned) || (listed !== null && paths.has(listed));
  });
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

/** Объединённый список по дереву: сначала по пути категории, внутри — как у поставщика. */
export function sortProductsInCategoryTree(products: CatalogProduct[]) {
  return [...products].sort((a, b) => {
    const ca = normalizePath(a.categoryPath);
    const cb = normalizePath(b.categoryPath);
    if (ca !== cb) return ca.localeCompare(cb, "ru");
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
