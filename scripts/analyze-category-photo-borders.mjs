/**
 * Определяет превью разделов с однотонными полями (часто белые) по данным sharp.trim,
 * считает коэффициент «увеличить, чтобы поля визуально ушли» и пишет src/data/categoryImageScale.json.
 *
 * Нужен доступ в интернет к URL картинок каталога. Сбой по отдельному URL не роняет сборку.
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(ROOT, "src", "data", "catalog.json");
const OUT_PATH = path.join(ROOT, "src", "data", "categoryImageScale.json");

const UA =
  "Mozilla/5.0 (compatible; RetailCatalogBot/1.0; +mailto:zakaz@en-msk.ru) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

const TRIM_THRESHOLD = 16;
const MIN_SCALE = 1.012;
const MAX_SCALE = 1.38;
const CONCURRENCY = 5;
const FETCH_MS = 28000;

function scaleFromTrim(meta, trimmedMeta) {
  if (!meta.width || !meta.height || !trimmedMeta.width || !trimmedMeta.height) return 1;
  const sw = meta.width / trimmedMeta.width;
  const sh = meta.height / trimmedMeta.height;
  /** Берём max: при полях только с боков или только сверху/снизу min давал бы почти 1. */
  let s = Math.max(sw, sh);
  if (!Number.isFinite(s) || s < MIN_SCALE) return 1;
  return Math.min(s, MAX_SCALE);
}

async function fetchBuf(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "image/*,*/*;q=0.8" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

async function analyzeOne(url) {
  try {
    const buf = await fetchBuf(url);
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return null;
    if (meta.format === "svg") return null;

    const trimmed = sharp(buf).trim({ threshold: TRIM_THRESHOLD });
    const trimmedBuf = await trimmed.toBuffer();
    const tMeta = await sharp(trimmedBuf).metadata();
    const scale = scaleFromTrim(meta, tMeta);
    return scale > 1 && scale >= MIN_SCALE ? scale : null;
  } catch (e) {
    console.warn(`[category-photo] skip ${url.slice(0, 72)}… → ${e.message ?? e}`);
    return null;
  }
}

async function poolMap(items, limit, fn) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const x = items[idx];
      out[idx] = await fn(x);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function main() {
  const raw = await fs.readFile(CATALOG_PATH, "utf8");
  /** @type {{ categories: { image?: string }[] }} */
  const catalog = JSON.parse(raw);
  const urls = [
    ...new Set(
      (catalog.categories ?? [])
        .map((c) => (typeof c.image === "string" ? c.image.trim() : ""))
        .filter((u) => u.startsWith("http")),
    ),
  ].sort();

  console.log(`[category-photo] Уникальных URL превью разделов: ${urls.length}`);

  const scales = {};
  const results = await poolMap(urls, CONCURRENCY, async (url) => {
    const s = await analyzeOne(url);
    return [url, s];
  });

  for (const pair of results) {
    if (!pair) continue;
    const [url, s] = pair;
    if (typeof s === "number") scales[url] = Math.round(s * 1000) / 1000;
  }

  const sorted = Object.keys(scales)
    .sort()
    .reduce((acc, k) => {
      acc[k] = scales[k];
      return acc;
    }, {});

  await fs.writeFile(OUT_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  console.log(
    `[category-photo] Записано ${Object.keys(sorted).length} масштабов (>1) → ${path.relative(ROOT, OUT_PATH)}`,
  );
}

main().catch((e) => {
  console.error("[category-photo]", e);
  process.exitCode = 1;
});
