export type CartLine = {
  slug: string;
  title: string;
  sku: string;
  image: string;
  qty: number;
  addedAt: number;
};

const KEY = "energosistema-cart-v1";
const LEGACY_DEFERRED_KEY = "energosistema-deferred-v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function totalQty(lines: CartLine[]): number {
  return lines.reduce((s, x) => s + x.qty, 0);
}

function migrateLegacyDeferred(): void {
  if (!canUseStorage()) return;
  try {
    const raw = localStorage.getItem(LEGACY_DEFERRED_KEY);
    if (!raw || localStorage.getItem(KEY)) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const lines: CartLine[] = parsed.map((x: Record<string, unknown>) => ({
      slug: String(x.slug ?? ""),
      title: String(x.title ?? ""),
      sku: String(x.sku ?? ""),
      image: String(x.image ?? ""),
      qty: 1,
      addedAt: typeof x.addedAt === "number" ? x.addedAt : Date.now(),
    }));
    localStorage.setItem(KEY, JSON.stringify(lines.filter((x) => x.slug)));
    localStorage.removeItem(LEGACY_DEFERRED_KEY);
  } catch {
    /* ignore */
  }
}

export function readCart(): CartLine[] {
  if (!canUseStorage()) return [];
  migrateLegacyDeferred();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x: CartLine) => ({
      ...x,
      qty: Math.max(1, Number(x.qty) || 1),
    }));
  } catch {
    return [];
  }
}

export function writeCart(items: CartLine[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cart-change", { detail: { count: totalQty(items) } }));
}

export function addToCart(line: Omit<CartLine, "qty" | "addedAt">) {
  const cur = readCart();
  const i = cur.findIndex((x) => x.slug === line.slug);
  if (i >= 0) {
    cur[i].qty += 1;
    writeCart(cur);
    return;
  }
  cur.unshift({ ...line, qty: 1, addedAt: Date.now() });
  writeCart(cur);
}

export function setQty(slug: string, qty: number) {
  const cur = readCart();
  const i = cur.findIndex((x) => x.slug === slug);
  if (i < 0) return;
  if (qty < 1) {
    cur.splice(i, 1);
    writeCart(cur);
    return;
  }
  cur[i].qty = qty;
  writeCart(cur);
}

export function removeLine(slug: string) {
  writeCart(readCart().filter((x) => x.slug !== slug));
}

export function clearCart() {
  writeCart([]);
}

export function qtyForSlug(slug: string): number {
  const line = readCart().find((x) => x.slug === slug);
  return line ? line.qty : 0;
}

export function cartTotalQty(): number {
  return totalQty(readCart());
}
