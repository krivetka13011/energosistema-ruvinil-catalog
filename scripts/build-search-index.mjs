import fs from "fs";
import path from "path";

const catalogPath = path.resolve("src/data/catalog.json");
const outPath = path.resolve("public/search-index.json");

function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePathname(p) {
  if (!p) return "/catalog/";
  const x = p.endsWith("/") ? p : `${p}/`;
  return x.replace(/\/{2,}/g, "/");
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const items = catalog.products.map((p) => {
  const sku = (p.properties && p.properties["Артикул"]) || "";
  const propsBlob = Object.entries(p.properties || {})
    .map(([k, v]) => `${k} ${v}`)
    .join(" ");
  const cp = normalizePathname(p.categoryPath);
  const cat = catalog.categories.find((c) => normalizePathname(c.pathname) === cp);
  const catTitle = cat ? cat.title : "";
  const haystack = norm(`${p.title} ${sku} ${propsBlob} ${catTitle}`);
  return {
    slug: p.slug,
    title: p.title,
    sku,
    category: catTitle,
    haystack,
  };
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), count: items.length, items }),
  "utf8",
);
console.error(`[search-index] ${items.length} items → ${outPath}`);
