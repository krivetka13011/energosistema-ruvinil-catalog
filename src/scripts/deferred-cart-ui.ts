import {
  addDeferred,
  hasDeferred,
  readDeferred,
  removeDeferred,
  type DeferredLine,
} from "./deferred-cart-storage";

function parsePayload(btn: HTMLElement): Omit<DeferredLine, "addedAt"> | null {
  const raw = btn.getAttribute("data-item");
  if (!raw) return null;
  try {
    const json = JSON.parse(atob(raw));
    if (!json.slug || !json.title) return null;
    return {
      slug: String(json.slug),
      title: String(json.title),
      sku: String(json.sku ?? ""),
      image: String(json.image ?? ""),
    };
  } catch {
    return null;
  }
}

function labelFor(btn: HTMLElement, inCart: boolean) {
  const label = btn.querySelector("[data-deferred-label]");
  const hint = btn.querySelector("[data-deferred-hint]");
  if (label) label.textContent = inCart ? "В отложенном" : "Отложить";
  if (hint)
    hint.textContent = inCart ? "Нажмите ещё раз, чтобы убрать" : "Сохраняется только в браузере";
  btn.setAttribute("aria-pressed", inCart ? "true" : "false");
  btn.classList.toggle("ring-2", inCart);
  btn.classList.toggle("ring-emerald-400/80", inCart);
  btn.classList.toggle("bg-emerald-50", inCart);
}

export function refreshDeferredButtonLabels() {
  document.querySelectorAll<HTMLElement>("[data-deferred-add]").forEach((btn) => {
    const payload = parsePayload(btn);
    if (!payload) return;
    labelFor(btn, hasDeferred(payload.slug));
  });
}

export function syncDeferredCartBadge() {
  const el = document.getElementById("deferred-cart-badge");
  if (!el) return;
  const n = readDeferred().length;
  el.textContent = String(n);
  el.classList.toggle("hidden", n === 0);
}

export function initDeferredCartUi() {
  if (typeof window === "undefined") return;

  document.body.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-deferred-add]");
    if (!btn) return;
    e.preventDefault();
    const payload = parsePayload(btn);
    if (!payload) return;
    if (hasDeferred(payload.slug)) removeDeferred(payload.slug);
    else addDeferred(payload);
    refreshDeferredButtonLabels();
    syncDeferredCartBadge();
  });

  syncDeferredCartBadge();
  refreshDeferredButtonLabels();
  window.addEventListener("deferred-cart-change", () => {
    syncDeferredCartBadge();
    refreshDeferredButtonLabels();
  });
}

initDeferredCartUi();

document.addEventListener("astro:after-swap", () => {
  syncDeferredCartBadge();
  refreshDeferredButtonLabels();
});
