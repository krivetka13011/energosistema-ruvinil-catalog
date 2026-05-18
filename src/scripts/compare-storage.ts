export function getCompareItems(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("compare-items");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function isCompared(slug: string): boolean {
  return getCompareItems().includes(slug);
}

export function addToCompare(slug: string) {
  const items = getCompareItems();
  if (!items.includes(slug)) {
    items.push(slug);
    localStorage.setItem("compare-items", JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("compare:updated"));
  }
}

export function removeFromCompare(slug: string) {
  const items = getCompareItems();
  const next = items.filter((i) => i !== slug);
  localStorage.setItem("compare-items", JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("compare:updated"));
}
