import { cartTotalQty, clearCart, readCart, removeLine, setQty } from "./cart-storage";

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

function renderList() {
  const root = document.getElementById(listRootId);
  if (!root) return;
  const items = readCart();
  const checkout = document.getElementById("cart-checkout-panel");
  if (!items.length) {
    root.innerHTML =
      '<p class="text-slate-600">Корзина пуста. Выберите товары в каталоге и нажмите «В корзину».</p>';
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
          <p class="mt-2 text-xs text-slate-500">Сумму и наличие сообщит менеджер после заявки.</p>
        </div>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <span class="sr-only">Количество</span>
          <button type="button" data-qty-dec="${esc(it.slug)}" class="h-9 w-9 rounded-lg border border-slate-200 font-semibold hover:bg-slate-50" aria-label="Меньше">−</button>
          <input type="number" min="1" value="${it.qty}" data-qty-input="${esc(it.slug)}" class="w-14 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm font-semibold" />
          <button type="button" data-qty-inc="${esc(it.slug)}" class="h-9 w-9 rounded-lg border border-slate-200 font-semibold hover:bg-slate-50" aria-label="Больше">+</button>
        </label>
        <button type="button" data-remove-slug="${esc(it.slug)}" class="text-sm font-semibold text-red-700 hover:underline">
          Удалить
        </button>
      </div>
    </li>`;
    })
    .join("")}</ul>`;
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
  const rows = lines.map((x, i) => `${i + 1}. ${x.title}${x.sku ? ` — арт. ${x.sku}` : ""} — ${x.qty} шт.`);
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
    `Всего наименований: ${lines.length}, всего единиц: ${cartTotalQty()}`,
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

export function mountCartPage() {
  const root = document.getElementById(listRootId);
  if (!root) return;
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

mountCartPage();

document.addEventListener("astro:after-swap", mountCartPage);

window.addEventListener("cart-change", () => {
  if (document.getElementById(listRootId)) renderList();
});
