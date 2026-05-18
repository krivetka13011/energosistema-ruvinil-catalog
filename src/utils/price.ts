import type { CatalogProduct } from "../types/catalog";

/** Первое положительное число в строке (цены на витрине / прайсе). */
export function parseFirstPositiveRub(text: string): number | null {
  const trimmed = text.replace(/\u00a0/g, " ").trim();
  if (!trimmed) return null;
  const noSpaces = trimmed.replace(/\s+/g, "");
  const m = noSpaces.match(/(\d+[.,]\d+|\d+)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatRub(n: number): string {
  const frac = Math.abs(n % 1) > 1e-9;
  return (
    new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: frac ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(n) + " ₽"
  );
}

/** Числовая цена за единицу учёта (шт., м и т.д.) для расчётов в корзине. */
export function catalogUnitPriceRub(product: CatalogProduct): number | null {
  const wholesale = product.properties["Опт. прайс, руб."]?.trim();
  if (wholesale) {
    const n = parseFirstPositiveRub(wholesale);
    if (n != null) return n;
  }
  if (!product.priceHint?.trim()) return null;
  return parseFirstPositiveRub(product.priceHint);
}

/** Подпись к цене, как на сайте / в прайсе (для строки корзины). */
export function catalogPriceLabelForCart(product: CatalogProduct): string {
  const rub = catalogUnitPriceRub(product);
  const wholesale = product.properties["Опт. прайс, руб."]?.trim();
  if (wholesale && rub != null) return `Опт: ${formatRub(rub)}`;
  if (product.priceHint?.trim()) return product.priceHint.trim();
  if (rub != null) return formatRub(rub);
  return "";
}
