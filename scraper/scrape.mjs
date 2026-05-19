import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";

import { normalizeCatalogPath, pickMoreSpecificCategoryPath } from "./category-path.mjs";
import { BASE, extractListingProducts, extractPaginationUrls } from "./listing-html.mjs";

/**
 * Зеркало каталога https://www.ruvinil.ru/catalog/ : те же разделы/подразделы (иерархия и названия),
 * те же товары в узлах, порядок как в листинге, полные характеристики и описание — с флагом --details.
 * Оформление сайта (UI) своё, источник данных только страницы поставщика.
 */

const UA =
  "Mozilla/5.0 (compatible; RetailCatalogBot/1.0; +mailto:zakaz@en-msk.ru) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DELAY_MS = Number(process.env.SCRAPE_DELAY_MS ?? 450);
const MAX_PAGES_RAW = process.env.SCRAPE_MAX_PAGES;
const MAX_PAGES =
  MAX_PAGES_RAW === undefined || MAX_PAGES_RAW === "" ? Number.POSITIVE_INFINITY : Number(MAX_PAGES_RAW);
const FETCH_RETRIES = Number(process.env.SCRAPE_FETCH_RETRIES ?? 4);
const WITH_DETAILS = process.argv.includes("--details");

/** @type {Map<string, { title: string, parentPath: string | null, image: string, sortHint?: number }>} */
const categoryMeta = new Map();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Ключ параметра пагинации Bitrix (часто PAGEN_1) по разметке страницы */
function inferPaginationParamKey(html) {
  const m = html.match(/PAGEN_(\d+)=\d+/);
  return m ? `PAGEN_${m[1]}` : "PAGEN_1";
}

/** @type {Map<string, string>} */
const lastListingProductSig = new Map();

function listingPathKey(pageUrl) {
  try {
    return normalizeCatalogPath(new URL(pageUrl).pathname) ?? "";
  } catch {
    return "";
  }
}

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

function sortProductsSupplierOrder(items) {
  return [...items].sort((a, b) => {
    const c = a.categoryPath.localeCompare(b.categoryPath, "ru");
    if (c !== 0) return c;
    const pa = a.listingPageIndex ?? 1;
    const pb = b.listingPageIndex ?? 1;
    if (pa !== pb) return pa - pb;
    return (a.listingPosition ?? 0) - (b.listingPosition ?? 0);
  });
}

async function fetchHtml(url) {
  let lastErr;
  for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
    await sleep(DELAY_MS);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ru-RU,ru;q=0.9",
        },
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        return buf.toString("utf8");
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        await sleep(DELAY_MS * (attempt + 2));
        continue;
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (e) {
      lastErr = e;
      if (attempt < FETCH_RETRIES - 1) await sleep(DELAY_MS * (attempt + 2));
    }
  }
  throw lastErr ?? new Error(`fetch failed ${url}`);
}

function dedupeSectionsByPath(sections) {
  const seen = new Set();
  const out = [];
  for (const s of sections) {
    if (seen.has(s.pathname)) continue;
    seen.add(s.pathname);
    out.push(s);
  }
  return out;
}

/** Inline SVG карточки раздела (напр. «Заказные позиции») → data URL для поля image */
function svgSectionToDataUrl($, svgSel) {
  if (!svgSel.length) return "";
  const raw = $.html(svgSel);
  if (!raw || raw.length > 200000) return "";
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
}

function extractSectionLinks(html, pageUrl) {
  const $ = cheerio.load(html);
  const out = [];
  $("a.catalog-section-item").each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href");
    const title = $a.find(".catalog-section-item-title").first().text().trim();
    if (!href || !title) return;

    let image = "";
    const $img = $a.find("img").first();
    const imgSrc = $img.attr("src") || $img.attr("data-src") || "";
    if (imgSrc) {
      try {
        image = new URL(imgSrc, BASE).href;
      } catch {
        image = imgSrc.startsWith("http") ? imgSrc : `${BASE}${imgSrc.startsWith("/") ? "" : "/"}${imgSrc}`;
      }
    } else {
      const $svg = $a.find("svg").first();
      image = svgSectionToDataUrl($, $svg);
    }

    try {
      const abs = new URL(href, pageUrl).href;
      const pathname = normalizeCatalogPath(new URL(abs).pathname);
      if (!pathname || pathname === "/catalog/") return;
      out.push({ url: `${BASE}${pathname}`, title, pathname, image });
    } catch {
      /* ignore */
    }
  });
  return out;
}

function mergeCategoryMeta(parentUrl, sections) {
  if (listingPageIndex(parentUrl) !== 1) return;
  const parentPath = normalizeCatalogPath(new URL(parentUrl).pathname);
  sections.forEach((s, idx) => {
    const existing = categoryMeta.get(s.pathname);
    if (!existing) {
      categoryMeta.set(s.pathname, {
        title: s.title,
        parentPath,
        image: s.image || "",
        sortHint: idx,
      });
    } else {
      if (existing.sortHint === undefined) existing.sortHint = idx;
      if (!existing.image && s.image) existing.image = s.image;
    }
  });
}

function pathToSlug(rel) {
  const trimmed = rel.replace(/^\/+|\/+$/g, "");
  return trimmed.replace(/\//g, "__");
}

async function enrichProductDetails(product) {
  const html = await fetchHtml(product.url);
  const $ = cheerio.load(html);
  const desc = $(".product-description").first().html()?.trim() ?? "";

  /** @type {Record<string, string>} */
  const detailProps = {};
  $(".product-detail .product-property").each((_, prop) => {
    const name = $(prop).find(".product-property-name").first().text().replace(/:\s*$/, "").trim();
    const value = $(prop).find(".product-property-value").first().text().trim();
    if (name && value) detailProps[name] = value;
  });

  const articleFromHeader = $(".article-property-custom .product-main-property-value").first().text().trim();
  if (articleFromHeader && !detailProps["Артикул"]) {
    detailProps["Артикул"] = articleFromHeader;
  }

  const images = [];
  $(".product-detail .product-images img, .product-images img").each((_, el) => {
    const $a = $(el).closest("a");
    const src = $a.attr("href") || $(el).attr("src") || $(el).attr("data-src") || "";
    if (!src) return;
    try {
      images.push(new URL(src, BASE).href);
    } catch {
      if (src.startsWith("http")) images.push(src);
      else images.push(`${BASE}${src}`);
    }
  });
  const uniq = [...new Set(images)];
  /** Не затираем данные с листинга (артикул и др.) — только дополняем с карточки товара. */
  const properties = { ...(product.properties || {}), ...detailProps };

  return {
    descriptionHtml: desc,
    images: uniq.length ? uniq : product.image ? [product.image] : [],
    properties,
  };
}

async function main() {
  /** @type {string[]} */
  const queue = [`${BASE}/catalog/`];
  const visited = new Set();
  /** @type {Map<string, any>} */
  const products = new Map();
  let pages = 0;

  const limitLabel =
    MAX_PAGES_RAW === undefined || MAX_PAGES_RAW === "" ? "не ограничено" : String(MAX_PAGES);

  console.error(`Scrape start (max pages ${limitLabel}, details=${WITH_DETAILS}, retries=${FETCH_RETRIES})`);

  while (queue.length && pages < MAX_PAGES) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);
    pages += 1;

    let html;
    try {
      html = await fetchHtml(url);
    } catch (e) {
      console.error(`Skip ${url}: ${e.message}`);
      continue;
    }

    const sections = dedupeSectionsByPath(extractSectionLinks(html, url));
    mergeCategoryMeta(url, sections);
    for (const s of sections) {
      const u = `${BASE}${s.pathname}`;
      if (!visited.has(u)) queue.push(u);
    }

    for (const p of extractPaginationUrls(html, url)) {
      if (!visited.has(p)) queue.push(p);
    }

    const found = extractListingProducts(html, url);
    for (const p of found) {
      const prev = products.get(p.url);
      if (!prev) {
        products.set(p.url, p);
        continue;
      }
      const chosen = pickMoreSpecificCategoryPath(categoryMeta, prev.categoryPath, p.categoryPath);
      if (chosen === p.categoryPath) products.set(p.url, p);
    }

    const lk = listingPathKey(url);
    const pi = listingPageIndex(url);
    if (lk && lk !== "/catalog/" && found.length > 0 && pi < 650) {
      const sig = found.map((x) => x.url).sort().join("|");
      const prev = lastListingProductSig.get(lk);
      if (!(prev === sig && pi > 1)) {
        lastListingProductSig.set(lk, sig);
        const paramKey = inferPaginationParamKey(html);
        try {
          const u = new URL(url);
          u.hash = "";
          u.search = "";
          let baseHref = u.href;
          if (!baseHref.endsWith("/")) baseHref = `${baseHref}/`;
          const nextUrl = `${baseHref}?${paramKey}=${pi + 1}`;
          if (!visited.has(nextUrl)) queue.push(nextUrl);
        } catch {
          /* ignore */
        }
      }
    }

    if (pages % 25 === 0) {
      console.error(`…pages ${pages}, queue ${queue.length}, products ${products.size}`);
    }
  }

  if (queue.length && Number.isFinite(MAX_PAGES)) {
    console.error(`Внимание: осталось ${queue.length} URL в очереди — достигнут SCRAPE_MAX_PAGES=${MAX_PAGES_RAW}`);
  }

  /** @type {any[]} */
  let list = sortProductsSupplierOrder([...products.values()]);

  if (WITH_DETAILS) {
    console.error(`Fetching details for ${list.length} products…`);
    let i = 0;
    for (const p of list) {
      i += 1;
      try {
        const extra = await enrichProductDetails(p);
        p.descriptionHtml = extra.descriptionHtml;
        p.images = extra.images;
        p.properties = extra.properties;
      } catch (e) {
        console.error(`Detail fail ${p.url}: ${e.message}`);
        p.descriptionHtml = "";
        p.images = p.image ? [p.image] : [];
      }
      if (i % 20 === 0) console.error(`…details ${i}/${list.length}`);
    }
  } else {
    for (const p of list) {
      p.descriptionHtml = "";
      p.images = p.image ? [p.image] : [];
    }
  }

  /** @type {{ pathname: string, title: string, parentPath: string | null, slug: string, image?: string, sortHint?: number }[]} */
  const categories = [...categoryMeta.entries()]
    .map(([pathname, meta]) => {
      /** @type {{ pathname: string, title: string, parentPath: string | null, slug: string, image?: string, sortHint?: number }} */
      const row = {
        pathname,
        title: meta.title,
        parentPath: meta.parentPath,
        slug: pathToSlug(pathname.replace(/^\/catalog\/?/, "")),
      };
      if (meta.image) row.image = meta.image;
      if (meta.sortHint !== undefined) row.sortHint = meta.sortHint;
      return row;
    })
    .sort((a, b) => a.pathname.localeCompare(b.pathname, "ru"));

  for (const p of list) {
    const u = new URL(p.url);
    const slugPath = u.pathname.replace(/^\/catalog\/?|\/$/g, "");
    p.slug = pathToSlug(slugPath);
    p.supplierPath = u.pathname;
  }

  const company = {
    name: "Энергосистема",
    legalNote: "Оптовые цены и наличие уточняйте по телефону или e-mail.",
    contacts: {
      address: "109651, Москва, ул. Иловайская, д. 10, стр. 1, офис 24",
      phone: "8 (800) 707-75-03",
      email: "zakaz@en-msk.ru",
      hours: "Пн. – Пт.: с 9:00 до 18:00",
    },
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    categories,
    products: list,
    company,
  };

  const outDir = path.resolve("src/data");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "catalog.json");
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2), "utf8");

  console.error(`Done. Pages fetched: ${pages}. Products: ${list.length}. Written ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
