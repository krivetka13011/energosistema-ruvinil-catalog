import type { SearchIndexRow } from "./search-core";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function hrefProduct(slug: string) {
  const base = import.meta.env.BASE_URL ?? "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}p/${slug}/`;
}

function addToCartHtml(row: SearchIndexRow): string {
  return `
    <div data-cart-widget data-cart-slug="${esc(row.slug)}" data-item="${esc(row.cartPayload)}" class="w-full">
      <div data-cart-idle class="w-full">
        <button type="button" data-cart-add-first class="flex w-full items-center justify-center rounded-xl px-4 py-3 text-center text-sm font-semibold shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:text-base bg-brand-600 text-white hover:bg-brand-700">
          Добавить в корзину
        </button>
      </div>
      <div data-cart-stepper class="hidden w-full">
        <div class="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-1 shadow-sm sm:gap-3">
          <button type="button" data-cart-dec class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-semibold text-brand-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label="Уменьшить количество">−</button>
          <input type="number" min="1" step="1" inputmode="numeric" data-cart-qty-input class="cart-qty-input min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-base font-semibold text-brand-950 tabular-nums outline-none ring-brand-600/30 focus:border-brand-600 focus:ring-2" aria-label="Количество" />
          <button type="button" data-cart-inc class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-semibold text-brand-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label="Увеличить количество">+</button>
        </div>
      </div>
    </div>`;
}

function compareButtonHtml(slug: string): string {
  return `
    <button type="button" data-compare-btn data-slug="${esc(slug)}" class="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-brand-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:text-base aria-pressed:border-brand-600 aria-pressed:bg-brand-50 aria-pressed:text-brand-800">
      <span data-compare-text>Добавить в сравнение</span>
    </button>`;
}

/** Разметка карточки товара — как ProductCard.astro */
export function renderProductCardHtml(row: SearchIndexRow): string {
  const img = row.image
    ? `<img src="${esc(row.image)}" alt="${esc(row.title)}" class="supplier-category-photo h-full w-full min-h-0 min-w-0 object-contain mix-blend-multiply" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : `<div class="flex h-full items-center justify-center text-sm text-slate-400">Нет фото</div>`;

  const priceBlock = row.priceHint
    ? `<p class="text-sm font-medium text-accent">${esc(row.priceHint)}</p>`
    : `<p class="text-sm text-slate-500">Оптовые цены уточняйте</p>`;

  const wholesale =
    row.wholesaleOpt && !row.slug.startsWith("price-list__")
      ? `<p class="text-sm font-semibold text-brand-900">Опт. по прайсу: ${esc(row.wholesaleOpt)} ₽</p>`
      : "";

  const availability = row.availability
    ? `<p class="text-xs text-emerald-700">${esc(row.availability)}</p>`
    : "";

  const skuBadge = row.sku
    ? `<span class="pointer-events-none absolute left-3 top-3 rounded-full bg-brand-900/90 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">арт. ${esc(row.sku)}</span>`
    : "";

  return `
    <div class="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-brand-600/25 hover:shadow-soft">
      <a href="${esc(hrefProduct(row.slug))}" class="flex flex-1 flex-col outline-none ring-brand-600/50 focus-visible:ring-2">
        <div class="relative aspect-[4/3] overflow-hidden bg-white flex items-center justify-center">
          ${img}
          ${skuBadge}
        </div>
        <div class="flex flex-1 flex-col gap-2 bg-white p-4">
          <h3 class="line-clamp-3 font-display text-base font-semibold leading-snug text-brand-950 group-hover:text-brand-700">${esc(row.title)}</h3>
          ${priceBlock}
          ${wholesale}
          ${availability}
        </div>
      </a>
      <div class="mt-auto border-t border-slate-100 bg-white px-4 py-3">
        <div class="flex flex-col gap-2">
          ${addToCartHtml(row)}
          ${compareButtonHtml(row.slug)}
        </div>
      </div>
    </div>`;
}
