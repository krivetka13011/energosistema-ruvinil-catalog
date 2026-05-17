import { addToCart, cartTotalQty, qtyForSlug, readCart, type CartLine } from "./cart-storage";

function parsePayload(btn: HTMLElement): Omit<CartLine, "qty" | "addedAt"> | null {
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

function labelFor(btn: HTMLElement, qty: number) {
  const label = btn.querySelector("[data-cart-label]");
  const hint = btn.querySelector("[data-cart-hint]");
  if (label) label.textContent = qty > 0 ? `В корзине: ${qty}` : "В корзину";
  if (hint) hint.textContent = qty > 0 ? "Нажмите, чтобы добавить ещё одну единицу" : "Оформление на странице корзины";
  btn.setAttribute("aria-pressed", qty > 0 ? "true" : "false");
  btn.classList.toggle("bg-brand-50", qty > 0);
  btn.classList.toggle("border-brand-400/60", qty > 0);
}

export function refreshCartButtonLabels() {
  document.querySelectorAll<HTMLElement>("[data-cart-add]").forEach((btn) => {
    const payload = parsePayload(btn);
    if (!payload) return;
    labelFor(btn, qtyForSlug(payload.slug));
  });
}

export function syncCartBadge() {
  const el = document.getElementById("cart-badge");
  if (!el) return;
  const n = cartTotalQty();
  el.textContent = String(n);
  el.classList.toggle("hidden", n === 0);
}

export function initCartUi() {
  if (typeof window === "undefined") return;

  document.body.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-cart-add]");
    if (!btn) return;
    e.preventDefault();
    const payload = parsePayload(btn);
    if (!payload) return;
    addToCart(payload);
    refreshCartButtonLabels();
    syncCartBadge();
  });

  syncCartBadge();
  refreshCartButtonLabels();
  window.addEventListener("cart-change", () => {
    syncCartBadge();
    refreshCartButtonLabels();
  });
}

initCartUi();

document.addEventListener("astro:after-swap", () => {
  syncCartBadge();
  refreshCartButtonLabels();
});
