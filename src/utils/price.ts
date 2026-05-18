import type { CatalogProduct } from "../types/catalog";

/** Первое положительное число в строке (цены на витрине / прайсе). */
export function parseFirstPositiveRub(text: string): number | null {
  const trimmed = text.replace(/\u00a0/g, " ").trim();
  if (!trimmed) return null;
  const unified = trimmed.replace(/(\d)\s+(?=\d)/g, "$1");
  const m = unified.match(/\d+[.,]\d+|\d+/);
  if (!m) return null;
  const n = Number.parseFloat(m[0].replace(",", "."));
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

/** Витринная подпись цены относится к погонному метру. */
export function isPricePerMeterHint(hint: string): boolean {
  const h = hint.toLowerCase().replace(/\u00a0/g, " ");
  // Не использовать \b: для кириллицы границы «слова» в JS работают неверно.
  return /руб\.?\s*\/\s*м/i.test(h) || /₽\s*\/\s*м/.test(h) || /rub\.?\s*\/\s*m/i.test(h);
}

/**
 * Длина одной отгрузочной единицы в метрах (бухта трубы и т.п.).
 * Берём из характеристик или из названия вида «… (15 м)».
 */
export function metersPerSaleUnit(product: CatalogProduct): number | null {
  const props = product.properties || {};
  const keys = [
    "Длина в бухте, м",
    "Длина в бухте",
    "Длина бухты, м",
    "Длина, м",
    "Длина (м)",
  ];
  for (const k of keys) {
    const raw = props[k]?.trim();
    if (!raw) continue;
    const cleaned = raw.replace(/\s*м\.?\s*$/i, "").trim();
    const n = parseFirstPositiveRub(cleaned);
    if (n != null && n > 0) return n;
  }
  const m = product.title.match(/\((\d+(?:[.,]\d+)?)\s*м\)/i);
  if (m) {
    const n = Number.parseFloat(m[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
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

/**
 * Цена одной упаковки/бухты для корзины: при «руб./м» умножаем ставку на длину бухты.
 * Если длину определить нельзя — возвращаем null (не считаем ставку за м как цену штуки).
 */
export function catalogCartUnitPriceRub(product: CatalogProduct): number | null {
  const rate = catalogUnitPriceRub(product);
  if (rate == null) return null;
  const hint = product.priceHint?.trim() ?? "";
  if (!hint || !isPricePerMeterHint(hint)) return Math.round(rate * 100) / 100;
  const meters = metersPerSaleUnit(product);
  if (meters == null) return null;
  return Math.round(rate * meters * 100) / 100;
}

/** Текст цены в корзине: поясняет расчёт за бухту при цене за метр. */
export function catalogCartPriceLabelForCart(product: CatalogProduct): string {
  const rate = catalogUnitPriceRub(product);
  if (rate == null) return catalogPriceLabelForCart(product);

  const hint = product.priceHint?.trim() ?? "";
  const wholesale = product.properties["Опт. прайс, руб."]?.trim();

  if (hint && isPricePerMeterHint(hint)) {
    const meters = metersPerSaleUnit(product);
    const head = wholesale ? `Опт: ${formatRub(rate)}/м` : hint;
    if (meters == null) {
      return `${head} — длина бухты не найдена в данных, сумму за упаковку считайте вручную`;
    }
    const total = Math.round(rate * meters * 100) / 100;
    return `${head} × ${String(meters).replace(".", ",")} м = ${formatRub(total)} за упаковку`;
  }

  return catalogPriceLabelForCart(product);
}
