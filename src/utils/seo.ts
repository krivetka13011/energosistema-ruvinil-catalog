import type { CatalogProduct } from "../types/catalog";

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateMeta(text: string, max = 160): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  const base = sp > 80 ? cut.slice(0, sp) : cut;
  return `${base.trim()}…`;
}

export function productMetaDescription(product: CatalogProduct, phone: string): string {
  if (product.descriptionHtml?.trim()) {
    return truncateMeta(stripHtml(product.descriptionHtml));
  }
  const sku = product.properties["Артикул"]?.trim();
  const chunks = [product.title.trim()];
  if (sku) chunks.push(`Артикул ${sku}`);
  if (product.priceHint?.trim()) chunks.push(product.priceHint.trim());
  chunks.push(`Заказ: ${phone}`);
  return truncateMeta(chunks.join(". "));
}

export function resolveOgImage(site: URL | undefined, imageUrl?: string): string | null {
  if (!imageUrl?.trim()) return site?.href ?? null;
  const raw = imageUrl.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!site) return null;
  return new URL(raw.startsWith("/") ? raw : `/${raw}`, site).href;
}
