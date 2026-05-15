import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";

const BASE = "https://www.ruvinil.ru";
const UA =
  "Mozilla/5.0 (compatible; CatalogMirror/1.0; retail partner indexing ruvinil.ru/catalog; contact: zakaz@en-msk.ru)";

const DELAY_MS = Number(process.env.SCRAPE_DELAY_MS ?? 450);
const MAX_PAGES = Number(process.env.SCRAPE_MAX_PAGES ?? 600);
const WITH_DETAILS = process.argv.includes("--details");

/** @type {Map<string, { title: string, parentPath: string | null }>} */
const categoryMeta = new Map();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeCatalogPath(pathname) {
  if (!pathname.startsWith("/catalog")) return null;
  const withSlash = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return withSlash.replace(/\/{2,}/g, "/");
}

async function fetchHtml(url) {
  await sleep(DELAY_MS);
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ru-RU,ru;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("utf8");
}

function extractPaginationUrls(html, pageUrl) {
  const $ = cheerio.load(html);
  const out = new Set();
  $('a[href*="PAGEN_"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, pageUrl).href;
      if (abs.includes(`${BASE}/catalog/`)) out.add(abs.split("#")[0]);
    } catch {
      /* ignore */
    }
  });
  return [...out];
}

function extractSectionLinks(html, pageUrl) {
  const $ = cheerio.load(html);
  const out = [];
  $("a.catalog-section-item").each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).find(".catalog-section-item-title").first().text().trim();
    if (!href || !title) return;
    try {
      const abs = new URL(href, pageUrl).href;
      const pathname = normalizeCatalogPath(new URL(abs).pathname);
      if (!pathname || pathname === "/catalog/") return;
      out.push({ url: `${BASE}${pathname}`, title, pathname });
    } catch {
      /* ignore */
    }
  });
  return out;
}

function extractProducts(html, pageUrl) {
  const $ = cheerio.load(html);
  const listingPath =
    normalizeCatalogPath(new URL(pageUrl).pathname) ?? "/catalog/";
  /** @type {any[]} */
  const items = [];
  $(".catalog-product-outer").each((_, outer) => {
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

    const imgSrc = box.find("a.product-picture img").first().attr("src") || "";
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
      categoryPath: listingPath,
    });
  });
  return items;
}

function mergeCategoryMeta(parentUrl, sections) {
  const parentPath = normalizeCatalogPath(new URL(parentUrl).pathname);
  for (const s of sections) {
    const existing = categoryMeta.get(s.pathname);
    if (!existing) {
      categoryMeta.set(s.pathname, { title: s.title, parentPath });
    }
  }
}

function pathToSlug(rel) {
  const trimmed = rel.replace(/^\/+|\/+$/g, "");
  return trimmed.replace(/\//g, "__");
}

async function enrichProductDetails(product) {
  const html = await fetchHtml(product.url);
  const $ = cheerio.load(html);
  const desc = $(".product-description").first().html()?.trim() ?? "";
  const images = [];
  $(".product-images img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    try {
      images.push(new URL(src, BASE).href);
    } catch {
      if (src.startsWith("http")) images.push(src);
      else images.push(`${BASE}${src}`);
    }
  });
  const uniq = [...new Set(images)];
  return { descriptionHtml: desc, images: uniq.length ? uniq : product.image ? [product.image] : [] };
}

async function main() {
  /** @type {string[]} */
  const queue = [`${BASE}/catalog/`];
  const visited = new Set();
  /** @type {Map<string, any>} */
  const products = new Map();
  let pages = 0;

  console.error(`Scrape start (max pages ${MAX_PAGES}, details=${WITH_DETAILS})`);

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

    const sections = extractSectionLinks(html, url);
    mergeCategoryMeta(url, sections);
    for (const s of sections) {
      const u = `${BASE}${s.pathname}`;
      if (!visited.has(u)) queue.push(u);
    }

    for (const p of extractPaginationUrls(html, url)) {
      if (!visited.has(p)) queue.push(p);
    }

    const found = extractProducts(html, url);
    for (const p of found) {
      products.set(p.url, p);
    }

    if (pages % 10 === 0) {
      console.error(`…pages ${pages}, queue ${queue.length}, products ${products.size}`);
    }
  }

  /** @type {any[]} */
  let list = [...products.values()];
  list.sort((a, b) => a.title.localeCompare(b.title, "ru"));

  if (WITH_DETAILS) {
    console.error(`Fetching details for ${list.length} products…`);
    let i = 0;
    for (const p of list) {
      i += 1;
      try {
        const extra = await enrichProductDetails(p);
        p.descriptionHtml = extra.descriptionHtml;
        p.images = extra.images;
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

  /** @type {{ pathname: string, title: string, parentPath: string | null }[]} */
  const categories = [...categoryMeta.entries()]
    .map(([pathname, meta]) => ({
      pathname,
      title: meta.title,
      parentPath: meta.parentPath,
      slug: pathToSlug(pathname.replace(/^\/catalog\/?/, "")),
    }))
    .sort((a, b) => a.pathname.localeCompare(b.pathname, "ru"));

  for (const p of list) {
    const u = new URL(p.url);
    const slugPath = u.pathname.replace(/^\/catalog\/?|\/$/g, "");
    p.slug = pathToSlug(slugPath);
    p.supplierPath = u.pathname;
  }

  const company = {
    name: "Энергосистема",
    legalNote:
      "Розничные цены и наличие уточняйте по телефону или e-mail. Описания и изображения ориентируются на каталог производителя.",
    contacts: {
      address: "109651, Москва, ул. Иловайская, д. 10, стр. 1, офис 24",
      phone: "8 (800) 707-75-03",
      email: "zakaz@en-msk.ru",
      hours: "Пн. – Пт.: с 9:00 до 18:00",
    },
    supplier: {
      name: "Рувинил",
      catalogUrl: `${BASE}/catalog/`,
    },
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceCatalog: `${BASE}/catalog/`,
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
