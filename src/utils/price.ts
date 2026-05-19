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

/** Количество из «100», «12x4», «12х4». */
export function parsePackQuantity(raw: string): number | null {
  const s = raw.replace(/\u00a0/g, " ").trim();
  if (!s) return null;
  const mul = s.match(/^(\d+)\s*[xх*×]\s*(\d+)$/i);
  if (mul) {
    const a = Number.parseInt(mul[1], 10);
    const b = Number.parseInt(mul[2], 10);
    if (a > 0 && b > 0) return a * b;
  }
  const n = parseFirstPositiveRub(s);
  return n != null && n > 0 ? n : null;
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

function formatQty(n: number): string {
  return String(n).replace(".", ",");
}

/** Витринная подпись цены относится к погонному метру. */
export function isPricePerMeterHint(hint: string): boolean {
  const h = hint.toLowerCase().replace(/\u00a0/g, " ");
  return /руб\.?\s*\/\s*м/i.test(h) || /₽\s*\/\s*м/.test(h) || /rub\.?\s*\/\s*m/i.test(h);
}

/** Витринная подпись цены относится к штуке. */
export function isPricePerPieceHint(hint: string): boolean {
  const h = hint.toLowerCase().replace(/\u00a0/g, " ");
  return /руб\.?\s*\/\s*шт/i.test(h) || /₽\s*\/\s*шт/.test(h) || /rub\.?\s*\/\s*(шт|sht)/i.test(h);
}

/**
 * Длина одной отгрузочной единицы в метрах (бухта трубы и т.п.).
 * Берём из характеристик или из названия вида «… (15 м)».
 */
export function metersPerSaleUnit(product: CatalogProduct): number | null {
  const props = product.properties ?? {};
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
  const endM = product.title.match(/(\d+(?:[.,]\d+)?)\s*м\s*$/i);
  if (endM) {
    const n = Number.parseFloat(endM[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Длина одной штуки в метрах (отрезок, крышка лотка 3000 мм и т.п.). */
export function pieceLengthMeters(product: CatalogProduct): number | null {
  const props = product.properties ?? {};
  for (const k of ["Кратность упаковки, м", "Длина отрезка, м", "Длина изделия, м"]) {
    const raw = props[k]?.trim();
    if (!raw) continue;
    const n = parseFirstPositiveRub(raw.replace(/\s*м\.?\s*$/i, ""));
    if (n != null && n > 0) return n;
  }
  const mmRe = /(\d+)\s*мм/gi;
  let lastMm: number | null = null;
  let mmMatch: RegExpExecArray | null;
  while ((mmMatch = mmRe.exec(product.title)) !== null) {
    const mm = Number.parseInt(mmMatch[1], 10);
    if (mm >= 100) lastMm = mm;
  }
  if (lastMm != null) return lastMm / 1000;
  const endM = product.title.match(/(\d+(?:[.,]\d+)?)\s*м\s*$/i);
  if (endM) {
    const n = Number.parseFloat(endM[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Штук в одной упаковке / отгрузочной единице. */
export function piecesPerSaleUnit(product: CatalogProduct): number | null {
  const props = product.properties ?? {};
  for (const k of ["Количество в упаковке, шт.", "Кол-во в упаковке, шт.", "В упаковке"]) {
    const raw = props[k]?.trim();
    if (!raw) continue;
    const n = parsePackQuantity(raw);
    if (n != null && n > 0) return n;
  }
  const m = product.title.match(/\(уп\.?\s*([^)]+?)\s*шт\.?\)/i);
  if (m) {
    const n = parsePackQuantity(m[1]);
    if (n != null && n > 0) return n;
  }
  return null;
}

/**
 * Полный метраж одной отгрузочной единицы (бухта, коробка кабель-канала, комплект лотков).
 */
export function saleUnitMeterQty(product: CatalogProduct): number | null {
  const props = product.properties ?? {};

  const coil = metersPerSaleUnit(product);
  if (coil != null) return coil;

  const packM = props["Количество в упаковке, м"]?.trim();
  if (packM) {
    const n = parseFirstPositiveRub(packM.replace(/\s*м\.?\s*$/i, ""));
    if (n != null && n > 0) return n;
  }

  const piece = pieceLengthMeters(product);
  const pcs = piecesPerSaleUnit(product);
  if (piece != null && pcs != null && pcs > 0) return Math.round(piece * pcs * 1000) / 1000;

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

function roundRub(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Цена одной упаковки/бухты для корзины: ставку умножаем на полный комплект
 * (метры, штуки в упаковке), когда это следует из характеристик.
 */
export function catalogCartUnitPriceRub(product: CatalogProduct): number | null {
  const rate = catalogUnitPriceRub(product);
  if (rate == null) return null;
  const hint = product.priceHint?.trim() ?? "";

  if (hint && isPricePerMeterHint(hint)) {
    const meters = saleUnitMeterQty(product);
    if (meters == null) return null;
    return roundRub(rate * meters);
  }

  if (!hint || isPricePerPieceHint(hint)) {
    const pcs = piecesPerSaleUnit(product);
    if (pcs != null && pcs > 1) return roundRub(rate * pcs);
  }

  return roundRub(rate);
}

/** Текст цены в корзине и на карточке: поясняет расчёт за полную упаковку. */
export function catalogCartPriceLabelForCart(product: CatalogProduct): string {
  const rate = catalogUnitPriceRub(product);
  if (rate == null) return catalogPriceLabelForCart(product);

  const hint = product.priceHint?.trim() ?? "";
  const wholesale = product.properties["Опт. прайс, руб."]?.trim();

  if (hint && isPricePerMeterHint(hint)) {
    const meters = saleUnitMeterQty(product);
    const head = wholesale ? `Опт: ${formatRub(rate)}/м` : hint;
    if (meters == null) {
      return `${head} — не удалось определить метраж упаковки, сумму считайте вручную`;
    }
    const total = roundRub(rate * meters);
    return `${head} × ${formatQty(meters)} м = ${formatRub(total)} за упаковку`;
  }

  if (!hint || isPricePerPieceHint(hint)) {
    const pcs = piecesPerSaleUnit(product);
    if (pcs != null && pcs > 1) {
      const head = wholesale ? `Опт: ${formatRub(rate)}/шт` : hint || `${formatRub(rate)}/шт`;
      const total = roundRub(rate * pcs);
      return `${head} × ${formatQty(pcs)} шт = ${formatRub(total)} за упаковку`;
    }
  }

  return catalogPriceLabelForCart(product);
}

/** Цена для отображения на карточке (с расчётом упаковки, если возможно). */
export function catalogCardPriceLabel(product: CatalogProduct): string {
  const calc = catalogCartPriceLabelForCart(product);
  if (calc && calc !== catalogPriceLabelForCart(product)) return calc;
  if (product.priceHint?.trim()) return product.priceHint.trim();
  return calc;
}
