import { readDeferred, removeDeferred } from "./deferred-cart-storage";

const rootId = "deferred-list-root";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function hrefProduct(slug: string) {
  const base = import.meta.env.BASE_URL;
  return `${base}p/${slug}/`;
}

function render() {
  const root = document.getElementById(rootId);
  if (!root) return;
  const items = readDeferred();
  if (!items.length) {
    root.innerHTML =
      '<p class="text-slate-600">Здесь пока ничего нет. Откройте карточку товара или каталог и нажмите «Отложить» — список хранится только в этом браузере.</p>';
    return;
  }
  root.innerHTML = `<ul class="space-y-4">${items
    .map((it) => {
      const imgSrc = JSON.stringify(it.image);
      return `
    <li class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <div class="flex min-w-0 flex-1 gap-4">
        <div class="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          ${
            it.image
              ? `<img src=${imgSrc} alt="" class="h-full w-full object-contain p-2" loading="lazy" />`
              : `<div class="flex h-full items-center justify-center text-xs text-slate-400">Нет фото</div>`
          }
        </div>
        <div class="min-w-0">
          ${it.sku ? `<p class="text-xs font-semibold uppercase tracking-wide text-accent">Артикул ${esc(it.sku)}</p>` : ""}
          <a href="${esc(hrefProduct(it.slug))}" class="mt-1 line-clamp-2 font-display text-lg font-semibold text-brand-900 hover:text-brand-700">${esc(it.title)}</a>
        </div>
      </div>
      <button type="button" data-remove-slug="${esc(it.slug)}" class="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        Убрать
      </button>
    </li>`;
    })
    .join("")}</ul>`;
}

function onClick(e: MouseEvent) {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-remove-slug]");
  if (!t) return;
  const slug = t.getAttribute("data-remove-slug");
  if (slug) removeDeferred(slug);
}

export function mountDeferredListPage() {
  const root = document.getElementById(rootId);
  if (!root) return;
  root.removeEventListener("click", onClick);
  root.addEventListener("click", onClick);
  render();
}

mountDeferredListPage();
window.addEventListener("deferred-cart-change", render);
document.addEventListener("astro:after-swap", mountDeferredListPage);
