type Row = { slug: string; title: string; sku: string; category: string; haystack: string };

let cache: Row[] | null = null;

async function loadItems(): Promise<Row[]> {
  if (cache) return cache;
  const originBase = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const resolvedBase = originBase.endsWith("/") ? originBase : `${originBase}/`;
  const res = await fetch(new URL("search-index.json", resolvedBase).href);
  if (!res.ok) throw new Error("search-index");
  const data = await res.json();
  cache = data.items as Row[];
  return cache;
}

function norm(q: string) {
  return q
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function match(items: Row[], query: string): Row[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return items.filter((row) => tokens.every((t) => row.haystack.includes(t))).slice(0, 200);
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function hrefProduct(slug: string) {
  return `${import.meta.env.BASE_URL}p/${slug}/`;
}

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export async function mountSearchPage() {
  const input = document.getElementById("catalog-search-input") as HTMLInputElement | null;
  const out = document.getElementById("catalog-search-results");
  const meta = document.getElementById("catalog-search-meta");
  if (!input || !out || !document.querySelector("[data-search-page]")) return;
  if (input.dataset.searchUiBound === "1") return;

  let items: Row[] = [];
  try {
    items = await loadItems();
    if (meta) meta.textContent = `В индексе ${items.length} позиций`;
  } catch {
    if (meta) meta.textContent = "Не удалось загрузить индекс поиска";
    out.innerHTML =
      '<p class="text-red-700 text-sm">Файл search-index.json недоступен. Пересоберите сайт (npm run build).</p>';
    return;
  }

  input.dataset.searchUiBound = "1";

  const run = () => {
    const found = match(items, input.value);
    if (!input.value.trim()) {
      out.innerHTML = '<p class="text-slate-500 text-sm">Введите название, артикул или слово из характеристик.</p>';
      return;
    }
    if (!found.length) {
      out.innerHTML = '<p class="text-slate-600">Ничего не найдено. Попробуйте другой запрос или короче артикул.</p>';
      return;
    }
    out.innerHTML = `<ul class="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">${found
      .map(
        (r) => `
      <li class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 hover:bg-slate-50">
        <div class="min-w-0 flex-1">
          <a href="${esc(hrefProduct(r.slug))}" class="font-medium text-brand-900 hover:text-brand-700">${esc(r.title)}</a>
          <div class="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
            ${r.sku ? `<span>Артикул: <span class="font-mono text-slate-700">${esc(r.sku)}</span></span>` : ""}
            ${r.category ? `<span>${esc(r.category)}</span>` : ""}
          </div>
        </div>
      </li>`,
      )
      .join("")}</ul>`;
  };

  input.addEventListener("input", debounce(run, 200));
  run();
}

mountSearchPage();
document.addEventListener("astro:after-swap", mountSearchPage);
