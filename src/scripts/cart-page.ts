import type { CartLine } from "./cart-storage";
import { cartTotalQty, clearCart, readCart, removeLine, setQty, writeCart } from "./cart-storage";
import { formatRub } from "../utils/price";

const listRootId = "cart-list-root";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function hrefProduct(slug: string) {
  return `${import.meta.env.BASE_URL}p/${slug}/`;
}

function orderEmailFromDom(): string {
  return document.querySelector("[data-order-email]")?.getAttribute("data-order-email")?.trim() ?? "";
}

type CartPriceEntry = { u: number; d: string };

async function loadCartPricesMap(): Promise<Record<string, CartPriceEntry>> {
  try {
    const base = import.meta.env.BASE_URL ?? "/";
    const normalized = base.endsWith("/") ? base : `${base}/`;
    const res = await fetch(`${normalized}cart-prices.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { prices?: Record<string, CartPriceEntry> };
    return json.prices && typeof json.prices === "object" ? json.prices : {};
  } catch {
    return {};
  }
}

/** Подставляет цены из собранного каталога для строк, сохранённых без полей цены (старая корзина). */
function enrichCartFromPriceMap(map: Record<string, CartPriceEntry>) {
  const raw = readCart();
  let changed = false;
  const out = raw.map((it) => {
    let next = { ...it };
    const ext = map[next.slug];
    if (ext && ext.u > 0) {
      const prevU = typeof next.unitPriceRub === "number" && Number.isFinite(next.unitPriceRub) ? next.unitPriceRub : NaN;
      if (!Number.isFinite(prevU) || Math.abs(prevU - ext.u) > 1e-5) {
        next.unitPriceRub = ext.u;
        changed = true;
      }
      if (ext.d?.trim() && next.priceDisplay !== ext.d) {
        next.priceDisplay = ext.d;
        changed = true;
      }
    }
    if ((typeof next.unitPriceRub === "number" && next.unitPriceRub > 0) && !next.priceDisplay?.trim()) {
      next.priceDisplay = formatRub(next.unitPriceRub);
      changed = true;
    }
    return next;
  });
  if (changed) writeCart(out);
}

function hasNumericPrice(it: { unitPriceRub?: number | null }): boolean {
  const p = it.unitPriceRub;
  return typeof p === "number" && p > 0 && Number.isFinite(p);
}

function linePriceSection(it: CartLine): string {
  const hasNum = hasNumericPrice(it);
  let html = "";
  if (it.priceDisplay?.trim()) {
    html += `<p class="mt-1 text-sm text-slate-700">${esc(it.priceDisplay.trim())}</p>`;
  }
  if (hasNum) {
    html += `<p class="mt-1 text-base font-semibold text-brand-900">${esc(formatRub(it.unitPriceRub! * it.qty))}</p>`;
  } else if (!it.priceDisplay?.trim()) {
    html += `<p class="mt-1 text-xs text-slate-500">Числовую цену не удалось взять из каталога — строка не участвует в сумме.</p>`;
  }
  return html;
}

function cartSummaryHtml(items: CartLine[]): string {
  let pricedLength = 0;
  const subtotal = items.reduce((s, it) => {
    if (hasNumericPrice(it)) {
      pricedLength++;
      return s + (it.unitPriceRub as number) * it.qty;
    }
    return s;
  }, 0);
  if (pricedLength === 0) {
    return `<div class="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700"><p class="font-medium text-brand-950">Итого не считается</p><p class="mt-1 text-xs text-slate-600">Для позиций в корзине не удалось определить цену из данных сайта.</p></div>`;
  }
  if (pricedLength === items.length) {
    return `<div class="mt-8 rounded-2xl border border-brand-200 bg-brand-50/90 px-6 py-4"><p class="text-lg font-semibold text-brand-950">Итого: ${esc(formatRub(subtotal))}</p><p class="mt-2 text-xs text-slate-600">Ориентировочная сумма по ценам из каталога. Финальную сумму и наличие подтвердит менеджер.</p></div>`;
  }
  return `<div class="mt-8 rounded-2xl border border-amber-200 bg-amber-50/80 px-6 py-4"><p class="text-lg font-semibold text-brand-950">Итого по позициям с ценой: ${esc(formatRub(subtotal))}</p><p class="mt-2 text-xs text-slate-700">Часть позиций без числовой цены в данных — полная сумма заказа ниже не показана.</p></div>`;
}

function renderList() {
  const root = document.getElementById(listRootId);
  if (!root) return;
  const items = readCart();
  const checkout = document.getElementById("cart-checkout-panel");
  if (!items.length) {
    root.innerHTML =
      '<p class="text-slate-600">Корзина пуста. Выберите товары в каталоге и нажмите «Добавить в корзину».</p>';
    if (checkout) checkout.classList.add("hidden");
    return;
  }
  if (checkout) checkout.classList.remove("hidden");

  root.innerHTML = `<ul class="space-y-4">${items
    .map((it) => {
      const imgSrc = JSON.stringify(it.image);
      return `
    <li class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <div class="flex min-w-0 flex-1 gap-4">
        <div class="h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          ${
            it.image
              ? `<img src=${imgSrc} alt="" class="h-full w-full object-contain p-2" loading="lazy" referrerpolicy="no-referrer" />`
              : `<div class="flex h-full items-center justify-center text-xs text-slate-400">Нет фото</div>`
          }
        </div>
        <div class="min-w-0 flex-1">
          ${it.sku ? `<p class="text-xs font-semibold uppercase tracking-wide text-accent">Артикул ${esc(it.sku)}</p>` : ""}
          <a href="${esc(hrefProduct(it.slug))}" class="mt-1 line-clamp-2 font-display text-lg font-semibold text-brand-900 hover:text-brand-700">${esc(it.title)}</a>
          ${linePriceSection(it)}
        </div>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <span class="sr-only">Количество</span>
          <button type="button" data-qty-dec="${esc(it.slug)}" class="h-9 w-9 rounded-lg border border-slate-200 font-semibold hover:bg-slate-50" aria-label="Меньше">−</button>
          <input type="number" min="1" value="${it.qty}" data-qty-input="${esc(it.slug)}" class="min-w-[3.25rem] rounded-lg border border-slate-200 px-2 py-1 text-center text-sm font-semibold tabular-nums" />
          <button type="button" data-qty-inc="${esc(it.slug)}" class="h-9 w-9 rounded-lg border border-slate-200 font-semibold hover:bg-slate-50" aria-label="Больше">+</button>
        </label>
        <button type="button" data-remove-slug="${esc(it.slug)}" class="text-sm font-semibold text-red-700 hover:underline">
          Удалить
        </button>
      </div>
    </li>`;
    })
    .join("")}</ul>${cartSummaryHtml(items)}`;
}

function onListClick(e: MouseEvent) {
  const root = document.getElementById(listRootId);
  if (!root || !root.contains(e.target as Node)) return;

  const rm = (e.target as HTMLElement).closest<HTMLElement>("[data-remove-slug]");
  if (rm) {
    const slug = rm.getAttribute("data-remove-slug");
    if (slug) removeLine(slug);
    renderList();
    window.dispatchEvent(new CustomEvent("cart-change"));
    return;
  }

  const dec = (e.target as HTMLElement).closest<HTMLElement>("[data-qty-dec]");
  if (dec) {
    const slug = dec.getAttribute("data-qty-dec");
    if (!slug) return;
    const line = readCart().find((x) => x.slug === slug);
    if (line) setQty(slug, line.qty - 1);
    renderList();
    window.dispatchEvent(new CustomEvent("cart-change"));
    return;
  }

  const inc = (e.target as HTMLElement).closest<HTMLElement>("[data-qty-inc]");
  if (inc) {
    const slug = inc.getAttribute("data-qty-inc");
    if (!slug) return;
    const line = readCart().find((x) => x.slug === slug);
    if (line) setQty(slug, line.qty + 1);
    renderList();
    window.dispatchEvent(new CustomEvent("cart-change"));
    return;
  }
}

function onListChange(e: Event) {
  const t = e.target as HTMLInputElement;
  if (!t.matches("[data-qty-input]")) return;
  const slug = t.getAttribute("data-qty-input");
  if (!slug) return;
  const v = Number.parseInt(t.value, 10);
  if (!Number.isFinite(v)) return;
  setQty(slug, v);
  renderList();
  window.dispatchEvent(new CustomEvent("cart-change"));
}

function buildOrderBody(name: string, phone: string, email: string): string {
  const lines = readCart();
  let pricedLength = 0;
  const subtotal = lines.reduce((s, it) => {
    if (hasNumericPrice(it)) {
      pricedLength++;
      return s + (it.unitPriceRub as number) * it.qty;
    }
    return s;
  }, 0);

  const rows = lines.map((x, i) => {
    let pricePart = "";
    if (hasNumericPrice(x)) {
      pricePart = ` — ${formatRub(x.unitPriceRub!)} × ${x.qty} = ${formatRub(x.unitPriceRub! * x.qty)}`;
    } else if (x.priceDisplay?.trim()) {
      pricePart = ` — ${x.priceDisplay.trim()}`;
    }
    return `${i + 1}. ${x.title}${x.sku ? ` — арт. ${x.sku}` : ""}${pricePart} — ${x.qty} шт.`;
  });

  const tail = [`Всего наименований: ${lines.length}, всего единиц: ${cartTotalQty()}`];
  if (pricedLength === lines.length && pricedLength > 0) {
    tail.push(`Итого по каталогу: ${formatRub(subtotal)}`);
  } else if (pricedLength > 0) {
    tail.push(`Итого по позициям с ценой: ${formatRub(subtotal)}`);
  }

  return [
    `Заказ с сайта`,
    ``,
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    `E-mail: ${email}`,
    ``,
    `Позиции:`,
    ...rows,
    ``,
    ...tail,
  ].join("\n");
}

function trimBody(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 60)}\n\n… (список частично обрезан из‑за ограничений почты — всего позиций больше.)`;
}

function bindCheckout(orderEmail: string) {
  const form = document.getElementById("cart-checkout-form") as HTMLFormElement | null;
  const msg = document.getElementById("cart-checkout-msg");
  if (!form || form.dataset.checkoutBound === "1") return;
  if (!orderEmail) return;
  form.dataset.checkoutBound = "1";

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("customer_name") ?? "").trim();
    const phone = String(fd.get("customer_phone") ?? "").trim();
    const email = String(fd.get("customer_email") ?? "").trim();
    if (!name || !phone || !email) {
      if (msg) msg.textContent = "Заполните имя, телефон и e-mail.";
      return;
    }
    if (!email.includes("@")) {
      if (msg) msg.textContent = "Проверьте формат e-mail.";
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      if (msg) msg.textContent = "Укажите телефон с кодом страны (например +79991234567).";
      return;
    }
    const bodyRaw = buildOrderBody(name, phone, email);
    const body = trimBody(bodyRaw, 1700);
    const subject = trimBody(`Заказ с сайта — ${name}`, 180);
    const mailto = `mailto:${encodeURIComponent(orderEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (msg)
      msg.textContent =
        "Открывается почтовый клиент. Если письмо не создалось, отправьте заказ вручную на " + orderEmail;
    window.location.href = mailto;
    clearCart();
    renderList();
    window.dispatchEvent(new CustomEvent("cart-change"));
    form.reset();
    const phoneInput = form.querySelector<HTMLInputElement>('[name="customer_phone"]');
    if (phoneInput) phoneInput.value = "+7";
  });
}

export async function mountCartPage() {
  const root = document.getElementById(listRootId);
  if (!root) return;
  const map = await loadCartPricesMap();
  enrichCartFromPriceMap(map);
  const email = orderEmailFromDom();
  root.removeEventListener("click", onListClick);
  root.addEventListener("click", onListClick);
  root.removeEventListener("change", onListChange);
  root.addEventListener("change", onListChange);
  const form = document.getElementById("cart-checkout-form") as HTMLFormElement | null;
  if (form) delete form.dataset.checkoutBound;
  bindCheckout(email);
  renderList();
}

void mountCartPage();

document.addEventListener("astro:after-swap", () => {
  void mountCartPage();
});

window.addEventListener("cart-change", () => {
  if (!document.getElementById(listRootId)) return;
  void loadCartPricesMap().then((map) => {
    enrichCartFromPriceMap(map);
    renderList();
  });
});
