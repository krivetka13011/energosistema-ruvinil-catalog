import {
  addToCart,
  cartTotalQty,
  qtyForSlug,
  removeLine,
  setQty,
  type CartLine,
} from "./cart-storage";

/** UTF-8 JSON из base64 (совместимо с Buffer.from(..., 'utf8').toString('base64') на сборке). */
function parseJsonFromBase64Utf8(raw: string): unknown {
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const text = new TextDecoder("utf-8").decode(bytes);
  return JSON.parse(text);
}

function parsePayload(widget: HTMLElement): Omit<CartLine, "qty" | "addedAt"> | null {
  const raw = widget.getAttribute("data-item");
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
    const unitRaw = o.unitPriceRub;
    const unitPriceRub =
      typeof unitRaw === "number" && Number.isFinite(unitRaw) && unitRaw > 0 ? unitRaw : null;
    return {
      slug: String(o.slug),
      title: String(o.title),
      sku: String(o.sku ?? ""),
      image: String(o.image ?? ""),
      unitPriceRub,
      priceDisplay: String(o.priceDisplay ?? ""),
    };
  } catch {
    return null;
  }
}

function syncCartWidget(el: HTMLElement) {
  const slug = el.getAttribute("data-cart-slug");
  if (!slug) return;
  const qty = qtyForSlug(slug);
  const idle = el.querySelector<HTMLElement>("[data-cart-idle]");
  const stepper = el.querySelector<HTMLElement>("[data-cart-stepper]");
  const input = el.querySelector<HTMLInputElement>("[data-cart-qty-input]");
  if (qty < 1) {
    idle?.classList.remove("hidden");
    stepper?.classList.add("hidden");
  } else {
    idle?.classList.add("hidden");
    stepper?.classList.remove("hidden");
    if (input) input.value = String(qty);
  }
}

export function refreshCartWidgets() {
  document.querySelectorAll<HTMLElement>("[data-cart-widget]").forEach(syncCartWidget);
}

export function syncCartBadge() {
  const el = document.getElementById("cart-badge");
  if (!el) return;
  const n = cartTotalQty();
  el.textContent = String(n);
  el.classList.toggle("hidden", n === 0);
}

function commitQtyInput(inp: HTMLInputElement) {
  const widget = inp.closest<HTMLElement>("[data-cart-widget]");
  const slug = widget?.getAttribute("data-cart-slug");
  if (!slug) return;
  const v = Number.parseInt(inp.value, 10);
  if (!Number.isFinite(v) || v < 1) {
    removeLine(slug);
  } else {
    setQty(slug, v);
  }
  refreshCartWidgets();
  syncCartBadge();
}

function bindCartWidgetClicks() {
  const w = window as unknown as { __cartUiDocClick?: boolean };
  if (w.__cartUiDocClick) return;
  w.__cartUiDocClick = true;

  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;

    const addFirst = t.closest<HTMLElement>("[data-cart-add-first]");
    if (addFirst) {
      const widget = addFirst.closest<HTMLElement>("[data-cart-widget]");
      if (!widget) return;
      e.preventDefault();
      const payload = parsePayload(widget);
      if (!payload) return;
      addToCart(payload);
      refreshCartWidgets();
      syncCartBadge();
      return;
    }

    const dec = t.closest<HTMLElement>("[data-cart-dec]");
    if (dec) {
      const widget = dec.closest<HTMLElement>("[data-cart-widget]");
      const slug = widget?.getAttribute("data-cart-slug");
      if (!slug) return;
      e.preventDefault();
      const q = qtyForSlug(slug);
      if (q <= 1) removeLine(slug);
      else setQty(slug, q - 1);
      refreshCartWidgets();
      syncCartBadge();
      return;
    }

    const inc = t.closest<HTMLElement>("[data-cart-inc]");
    if (inc) {
      const widget = inc.closest<HTMLElement>("[data-cart-widget]");
      const slug = widget?.getAttribute("data-cart-slug");
      if (!slug) return;
      e.preventDefault();
      const q = qtyForSlug(slug);
      if (q < 1) {
        const payload = parsePayload(widget);
        if (payload) addToCart(payload);
      } else {
        setQty(slug, q + 1);
      }
      refreshCartWidgets();
      syncCartBadge();
    }
  });

  document.addEventListener("change", (e) => {
    const t = e.target as HTMLElement;
    if (t.matches("[data-cart-qty-input]")) commitQtyInput(t as HTMLInputElement);
  });

  document.addEventListener(
    "blur",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.matches("[data-cart-qty-input]")) commitQtyInput(t as HTMLInputElement);
    },
    true,
  );
}

export function initCartUi() {
  if (typeof window === "undefined") return;

  bindCartWidgetClicks();

  syncCartBadge();
  refreshCartWidgets();

  const w2 = window as unknown as { __cartUiCartChange?: boolean };
  if (!w2.__cartUiCartChange) {
    w2.__cartUiCartChange = true;
    window.addEventListener("cart-change", () => {
      syncCartBadge();
      refreshCartWidgets();
    });
  }
}

initCartUi();

document.addEventListener("astro:after-swap", () => {
  syncCartBadge();
  refreshCartWidgets();
});
