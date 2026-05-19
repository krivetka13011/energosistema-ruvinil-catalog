export type SearchIndexRow = {
  slug: string;
  title: string;
  sku: string;
  category: string;
  image: string;
  priceHint: string;
  haystack: string;
  unitPriceRub: number | null;
  priceDisplay: string;
  cartPayload: string;
};

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Единый формат для запроса и индекса: 100м → 100 м, метров → м. */
export function normSearchText(s: string): string {
  let x = norm(s);
  x = x.replace(/(\d)\s*метр(ов|а|ы)?/gi, "$1 м");
  x = x.replace(/(\d)(мм|м|шт)(?=\s|$|[.,])/gi, "$1 $2");
  x = x.replace(/(\d)мм\b/gi, "$1 мм");
  x = x.replace(/(\d)м\b/g, "$1 м");
  x = x.replace(/гофрирован\w*/g, "гофра");
  x = x.replace(/(\d)\s*х\s*(\d)/g, "$1x$2");
  return x.replace(/\s+/g, " ").trim();
}

export function queryTokens(query: string): string[] {
  const q = normSearchText(query);
  if (!q) return [];
  return q.split(/\s+/).filter((t) => t.length > 0);
}

export function rowMatches(row: SearchIndexRow, query: string): boolean {
  const tokens = queryTokens(query);
  if (!tokens.length) return false;
  const hay = row.haystack;
  return tokens.every((t) => hay.includes(t));
}

export function scoreRow(row: SearchIndexRow, query: string): number {
  const tokens = queryTokens(query);
  if (!tokens.length) return 0;
  const title = normSearchText(row.title);
  const qNorm = normSearchText(query);
  let score = 0;
  if (title.startsWith(qNorm)) score += 80;
  else if (title.includes(qNorm)) score += 40;
  for (const t of tokens) {
    if (title.includes(t)) score += 12;
    if (row.sku && norm(row.sku).includes(t)) score += 18;
    if (row.haystack.includes(t)) score += 4;
  }
  return score;
}

export function searchRows(items: SearchIndexRow[], query: string, limit = 12): SearchIndexRow[] {
  const q = query.trim();
  if (!q) return [];
  const scored = items
    .filter((row) => rowMatches(row, q))
    .map((row) => ({ row, score: scoreRow(row, q) }))
    .sort((a, b) => b.score - a.score || a.row.title.localeCompare(b.row.title, "ru"));
  return scored.slice(0, limit).map((x) => x.row);
}

let cache: SearchIndexRow[] | null = null;

export async function loadSearchIndex(): Promise<SearchIndexRow[]> {
  if (cache) return cache;
  const originBase = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const resolvedBase = originBase.endsWith("/") ? originBase : `${originBase}/`;
  const res = await fetch(new URL("search-index.json", resolvedBase).href);
  if (!res.ok) throw new Error("search-index");
  const data = await res.json();
  cache = data.items as SearchIndexRow[];
  return cache;
}

export function encodeCartPayload(item: {
  slug: string;
  title: string;
  sku: string;
  image: string;
  unitPriceRub: number | null;
  priceDisplay: string;
}): string {
  const json = JSON.stringify({
    slug: item.slug,
    title: item.title,
    sku: item.sku,
    image: item.image,
    unitPriceRub: item.unitPriceRub,
    priceDisplay: item.priceDisplay,
  });
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
