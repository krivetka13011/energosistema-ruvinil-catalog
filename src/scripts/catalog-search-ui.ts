import { refreshCartWidgets } from "./cart-ui";
import { flyToCart } from "./cart-fly";
import { loadSearchIndex, searchRows, type SearchIndexRow } from "./search-core";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function hrefProduct(slug: string) {
  const base = import.meta.env.BASE_URL ?? "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}p/${slug}/`;
}

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function miniCartWidgetHtml(row: SearchIndexRow): string {
  return `
    <div data-cart-widget data-cart-slug="${esc(row.slug)}" data-item="${esc(row.cartPayload)}" class="w-full min-w-[8.5rem] shrink-0">
      <div data-cart-idle class="w-full">
        <button type="button" data-cart-add-first class="w-full rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700">
          В корзину
        </button>
      </div>
      <div data-cart-stepper class="hidden w-full">
        <div class="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button type="button" data-cart-dec class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-semibold" aria-label="Меньше">−</button>
          <input type="number" min="1" step="1" data-cart-qty-input class="cart-qty-input min-w-0 w-9 rounded-md border border-slate-200 bg-white py-1 text-center text-xs font-semibold tabular-nums" aria-label="Количество" />
          <button type="button" data-cart-inc class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-semibold" aria-label="Больше">+</button>
        </div>
      </div>
    </div>`;
}

function renderDropdown(dropdown: HTMLElement, rows: SearchIndexRow[], query: string) {
  if (!query.trim()) {
    dropdown.classList.add("hidden");
    dropdown.innerHTML = "";
    return;
  }
  if (!rows.length) {
    dropdown.classList.remove("hidden");
    dropdown.innerHTML =
      '<p class="px-4 py-6 text-sm text-slate-600">Ничего не найдено. Попробуйте артикул, «100 м» или другой порядок слов.</p>';
    return;
  }
  dropdown.classList.remove("hidden");
  dropdown.innerHTML = `<ul class="max-h-[min(28rem,70vh)] divide-y divide-slate-100 overflow-y-auto">${rows
    .map((r) => {
      const img = r.image
        ? `<img src="${esc(r.image)}" alt="" class="h-full w-full object-contain p-1 mix-blend-multiply" loading="lazy" referrerpolicy="no-referrer" />`
        : `<span class="text-[10px] text-slate-400">Нет фото</span>`;
      const price = r.priceHint;
      return `
      <li class="flex gap-3 p-3 hover:bg-slate-50">
        <a href="${esc(hrefProduct(r.slug))}" class="flex min-w-0 flex-1 gap-3">
          <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-100">${img}</div>
          <div class="min-w-0 flex-1">
            <p class="line-clamp-2 text-sm font-semibold text-brand-900">${esc(r.title)}</p>
            <p class="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
              ${r.sku ? `<span>арт. ${esc(r.sku)}</span>` : ""}
              ${r.category ? `<span>${esc(r.category)}</span>` : ""}
            </p>
            ${price ? `<p class="mt-1 text-xs font-medium text-accent">${esc(price)}</p>` : ""}
          </div>
        </a>
        ${miniCartWidgetHtml(r)}
      </li>`;
    })
    .join("")}</ul>`;
  refreshCartWidgets();
}

export async function mountCatalogSearch(root: HTMLElement) {
  if (root.dataset.searchBound === "1") return;

  const input = root.querySelector<HTMLInputElement>("[data-catalog-search-input]");
  const dropdown = root.querySelector<HTMLElement>("[data-catalog-search-dropdown]");
  if (!input || !dropdown) return;

  let items: SearchIndexRow[] = [];
  try {
    items = await loadSearchIndex();
  } catch {
    root.dataset.searchBound = "1";
    dropdown.innerHTML =
      '<p class="px-4 py-3 text-sm text-red-700">Индекс поиска недоступен. Пересоберите сайт.</p>';
    dropdown.classList.remove("hidden");
    return;
  }

  root.dataset.searchBound = "1";

  const run = debounce(() => {
    const q = input.value;
    const found = searchRows(items, q, 10);
    renderDropdown(dropdown, found, q);
  }, 180);

  input.addEventListener("input", run);
  input.addEventListener("focus", () => {
    if (input.value.trim()) run();
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target as Node)) dropdown.classList.add("hidden");
  });

  root.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-cart-add-first]");
    if (!btn || !root.contains(btn)) return;
    flyToCart(btn);
  });

  const params = new URLSearchParams(window.location.search);
  const q0 = params.get("q");
  if (q0) {
    input.value = q0;
    run();
  }
}

function mountAll() {
  document.querySelectorAll<HTMLElement>("[data-catalog-search]").forEach((el) => {
    void mountCatalogSearch(el);
  });
}

mountAll();
document.addEventListener("astro:after-swap", mountAll);
