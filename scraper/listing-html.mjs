import * as cheerio from "cheerio";
import { normalizeCatalogPath } from "./category-path.mjs";

export const BASE = "https://www.ruvinil.ru";

/** Номер страницы листинга Bitrix (?PAGEN_1=N), без параметра — 1 */
function listingPageIndex(pageUrl) {
  try {
    const u = new URL(pageUrl);
    for (const [k, v] of u.searchParams.entries()) {
      if (/^PAGEN_\d+$/.test(k)) {
        const n = Number.parseInt(v, 10);
        if (Number.isFinite(n) && n >= 1) return n;
      }
    }
  } catch {
    /* ignore */
  }
  return 1;
}

export function extractPaginationUrls(html, pageUrl) {
  const $ = cheerio.load(html);
  const out = new Set();
  let curPathNorm;
  try {
    curPathNorm = normalizeCatalogPath(new URL(pageUrl).pathname);
  } catch {
    return [];
  }
  if (!curPathNorm) return [];

  $('a[href*="PAGEN_"], a:contains("След"), a.bx-pag-next, a[rel="next"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, pageUrl).href.split("#")[0];
      if (!abs.includes(`${BASE}/catalog/`)) return;
      const u = new URL(abs);
      if (normalizeCatalogPath(u.pathname) !== curPathNorm) return;
      out.add(abs);
    } catch {
      /* ignore */
    }
  });

  let maxPage = 1;
  /** @type {string} */
  let paramKey = "PAGEN_1";
  for (const link of out) {
    const u = new URL(link);
    for (const [k, v] of u.searchParams.entries()) {
      if (!/^PAGEN_\d+$/.test(k)) continue;
      paramKey = k;
      const n = Number.parseInt(v, 10);
      if (Number.isFinite(n) && n > maxPage) maxPage = n;
    }
  }

  for (const m of html.matchAll(/PAGEN_(\d+)=(\d+)/g)) {
    const k = `PAGEN_${m[1]}`;
    const n = Number.parseInt(m[2], 10);
    if (Number.isFinite(n) && n > maxPage) {
      maxPage = n;
      paramKey = k;
    }
  }

  const SAFE_MAX_PAGES = 600;
  if (maxPage > SAFE_MAX_PAGES) {
    console.error(`Pagination для ${curPathNorm}: обрезано ${maxPage} → ${SAFE_MAX_PAGES} (страховка)`);
    maxPage = SAFE_MAX_PAGES;
  }

  if (maxPage > 1) {
    try {
      const base = new URL(pageUrl);
      base.hash = "";
      base.search = "";
      let baseHref = base.href;
      if (!baseHref.endsWith("/")) baseHref = `${baseHref}/`;
      for (let n = 2; n <= maxPage; n++) {
        const syn = `${baseHref}?${paramKey}=${n}`;
        const u = new URL(syn);
        if (normalizeCatalogPath(u.pathname) === curPathNorm) out.add(u.href.split("#")[0]);
      }
    } catch {
      /* ignore */
    }
  }

  return [...out];
}

export function extractListingProducts(html, pageUrl) {
  const $ = cheerio.load(html);
  const listingPath =
    normalizeCatalogPath(new URL(pageUrl).pathname) ?? "/catalog/";
  const pageIdx = listingPageIndex(pageUrl);
  /** @type {any[]} */
  const items = [];
  $(".catalog-product-outer").each((idx, outer) => {
    const box = $(outer).find(".catalog-product").first();
    const titleA = box.find(".product-bottom a.product-title").first();
    const href = titleA.attr("href");
    const title = titleA.text().trim();
    if (!href || !title) return;

    let absUrl;
    try {
      absUrl = new URL(href, pageUrl).href;
    } catch {
      return;
    }
    if (!absUrl.includes("/catalog/")) return;

    const imgEl = box.find("a.product-picture img").first();
    const imgSrc = imgEl.attr("src") || imgEl.attr("data-src") || imgEl.attr("data-lazyload-src") || "";
    let image = imgSrc;
    try {
      image = imgSrc ? new URL(imgSrc, BASE).href : "";
    } catch {
      image = imgSrc.startsWith("http") ? imgSrc : `${BASE}${imgSrc}`;
    }

    /** @type {Record<string, string>} */
    const properties = {};
    box.find(".product-bottom .product-property").each((__, prop) => {
      const name = $(prop).find(".product-property-name").first().text().replace(/:\s*$/, "").trim();
      const value = $(prop).find(".product-property-value").first().text().trim();
      if (name && value) properties[name] = value;
    });

    let priceHint = "";
    const priceBox = box.find(".product-bottom .product-base-price .base-price-help div").first();
    if (priceBox.length) priceHint = priceBox.text().replace(/\s+/g, " ").trim();

    const availability = box.find(".product-bottom .product-available span").first().text().trim();

    items.push({
      url: absUrl.split("#")[0],
      title,
      image,
      properties,
      priceHint,
      availability,
      listingPage: pageUrl,
      listingPageIndex: pageIdx,
      listingPosition: idx,
      categoryPath: listingPath,
    });
  });
  return items;
}
