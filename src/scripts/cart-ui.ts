import { addToCart, cartTotalQty, qtyForSlug, type CartLine } from "./cart-storage";

/** UTF-8 JSON из base64 (совместимо с Buffer.from(..., 'utf8').toString('base64') на сборке). */
function parseJsonFromBase64Utf8(raw: string): unknown {
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const text = new TextDecoder("utf-8").decode(bytes);
  return JSON.parse(text);
}

function parsePayload(btn: HTMLElement): Omit<CartLine, "qty" | "addedAt"> | null {
  const raw = btn.getAttribute("data-item");
  if (!raw) return null;
  try {
    let json: unknown;
    try {
      json = parseJsonFromBase64Utf8(raw);
    } catch {
      json = JSON.parse(decodeURIComponent(raw));
    }
    if (!json || typeof json !== "object") return null;
    const o = json as Record<string, unknown>;
    if (!o.slug || !o.title) return null;
    return {
      slug: String(o.slug),
      title: String(o.title),
      sku: String(o.sku ?? ""),
      image: String(o.image ?? ""),
    };
  } catch {
    return null;
  }
}

function labelFor(btn: HTMLElement, qty: number) {
  const label = btn.querySelector("[data-cart-label]");
  if (label) {
    label.textContent =
      qty > 0 ? `В корзине: ${qty}` : "Добавить товар в корзину";
  }
  btn.setAttribute("aria-pressed", qty > 0 ? "true" : "false");
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

  const w = window as unknown as { __cartUiDocClick?: boolean };
  if (!w.__cartUiDocClick) {
    w.__cartUiDocClick = true;
    document.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-cart-add]");
      if (!btn) return;
      e.preventDefault();
      const payload = parsePayload(btn);
      if (!payload) return;
      addToCart(payload);
      refreshCartButtonLabels();
      syncCartBadge();
    });
  }

  syncCartBadge();
  refreshCartButtonLabels();
  const w2 = window as unknown as { __cartUiCartChange?: boolean };
  if (!w2.__cartUiCartChange) {
    w2.__cartUiCartChange = true;
    window.addEventListener("cart-change", () => {
      syncCartBadge();
      refreshCartButtonLabels();
    });
  }
}

initCartUi();

document.addEventListener("astro:after-swap", () => {
  syncCartBadge();
  refreshCartButtonLabels();
});
