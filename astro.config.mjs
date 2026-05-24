import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

function normalizeBase(raw) {
  if (!raw || raw === "/") return "/";
  let b = String(raw).trim();
  if (!b.startsWith("/")) b = `/${b}`;
  return b.endsWith("/") ? b : `${b}/`;
}

function resolveBase() {
  if (process.env.PUBLIC_BASE_PATH)
    return normalizeBase(process.env.PUBLIC_BASE_PATH);
  // На GitHub Actions имя репозитория = сегмент пути project Pages
  if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split("/")[1];
    if (repo) return normalizeBase(`/${repo}`);
  }
  return "/";
}

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || "https://example.pages.dev",
  base: resolveBase(),
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap({
      filter: (page) =>
        !page.includes("/cart/") &&
        !page.includes("/compare/") &&
        !page.includes("/search/"),
    }),
  ],
});
