import fs from "fs";
import path from "path";

function normalizeBase(raw) {
  if (!raw || raw === "/") return "/";
  let b = String(raw).trim();
  if (!b.startsWith("/")) b = `/${b}`;
  return b.endsWith("/") ? b : `${b}/`;
}

function resolveBase() {
  if (process.env.PUBLIC_BASE_PATH) return normalizeBase(process.env.PUBLIC_BASE_PATH);
  if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split("/")[1];
    if (repo) return normalizeBase(`/${repo}`);
  }
  return "/";
}

const siteRaw = (process.env.PUBLIC_SITE_URL || "https://example.com").trim().replace(/\/+$/, "");
const base = resolveBase();
const sitemapPath = base === "/" ? "/sitemap-index.xml" : `${base}sitemap-index.xml`;
const sitemapUrl = `${siteRaw}${sitemapPath.startsWith("/") ? sitemapPath : `/${sitemapPath}`}`;

const lines = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /cart/",
  "Disallow: /compare/",
  "",
  "User-agent: Yandex",
  "Allow: /",
  "Disallow: /cart/",
  "Disallow: /compare/",
  "Clean-param: q&search /catalog/",
  "Clean-param: q /catalog/",
  "",
  `Sitemap: ${sitemapUrl}`,
  "",
];

const outPath = path.resolve("public/robots.txt");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.error(`[robots.txt] ${outPath} → Sitemap: ${sitemapUrl}`);
