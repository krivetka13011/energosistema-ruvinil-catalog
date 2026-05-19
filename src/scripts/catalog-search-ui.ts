import { refreshCartWidgets } from "./cart-ui";
import { flyToCart } from "./cart-fly";
import { bindCompareButtons } from "./compare-ui";
import { renderProductCardHtml } from "./product-card-html";
import { loadSearchIndex, searchRows, type SearchIndexRow } from "./search-core";

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function pageRoot(input: HTMLElement): HTMLElement {
  return input.closest<HTMLElement>("[data-catalog-page]") ?? document.body;
}

function renderResults(
  page: HTMLElement,
  rows: SearchIndexRow[],
  query: string,
) {
  const browse = page.querySelector<HTMLElement>("[data-catalog-browse]");
  const panel = page.querySelector<HTMLElement>("[data-catalog-search-results]");
  const grid = page.querySelector<HTMLElement>("[data-catalog-search-grid]");
  const meta = page.querySelector<HTMLElement>("[data-catalog-search-meta]");
  const empty = page.querySelector<HTMLElement>("[data-catalog-search-empty]");

  const q = query.trim();
  const active = q.length > 0;

  browse?.classList.toggle("hidden", active);
  panel?.classList.toggle("hidden", !active);

  if (!active || !panel || !grid) return;

  if (!rows.length) {
    grid.innerHTML = "";
    empty?.classList.remove("hidden");
    if (meta) meta.textContent = "";
    return;
  }

  empty?.classList.add("hidden");
  if (meta) meta.textContent = `Найдено: ${rows.length}${rows.length >= 200 ? " (показаны первые 200)" : ""}`;
  grid.innerHTML = rows.map((r) => renderProductCardHtml(r)).join("");

  refreshCartWidgets();
  bindCompareButtons();
}

export async function mountCatalogSearch(root: HTMLElement) {
  if (root.dataset.searchBound === "1") return;

  const input = root.querySelector<HTMLInputElement>("[data-catalog-search-input]");
  if (!input) return;

  const page = pageRoot(input);

  let items: SearchIndexRow[] = [];
  try {
    items = await loadSearchIndex();
  } catch {
    root.dataset.searchBound = "1";
    const panel = page.querySelector<HTMLElement>("[data-catalog-search-results]");
    const empty = page.querySelector<HTMLElement>("[data-catalog-search-empty]");
    page.querySelector<HTMLElement>("[data-catalog-browse]")?.classList.add("hidden");
    panel?.classList.remove("hidden");
    if (empty) {
      empty.textContent = "Индекс поиска недоступен. Пересоберите сайт.";
      empty.classList.remove("hidden");
    }
    return;
  }

  root.dataset.searchBound = "1";

  const run = debounce(() => {
    const q = input.value;
    const found = searchRows(items, q, 200);
    renderResults(page, found, q);
  }, 220);

  input.addEventListener("input", run);

  page.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-cart-add-first]");
    if (!btn || !page.contains(btn)) return;
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
