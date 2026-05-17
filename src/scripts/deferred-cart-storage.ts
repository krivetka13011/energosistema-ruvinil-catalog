export type DeferredLine = {
  slug: string;
  title: string;
  sku: string;
  image: string;
  addedAt: number;
};

const KEY = "energosistema-deferred-v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readDeferred(): DeferredLine[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeDeferred(items: DeferredLine[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("deferred-cart-change", { detail: { count: items.length } }));
}

export function addDeferred(line: Omit<DeferredLine, "addedAt">) {
  const cur = readDeferred();
  if (cur.some((x) => x.slug === line.slug)) return;
  cur.unshift({ ...line, addedAt: Date.now() });
  writeDeferred(cur);
}

export function removeDeferred(slug: string) {
  writeDeferred(readDeferred().filter((x) => x.slug !== slug));
}

export function hasDeferred(slug: string): boolean {
  return readDeferred().some((x) => x.slug === slug);
}
