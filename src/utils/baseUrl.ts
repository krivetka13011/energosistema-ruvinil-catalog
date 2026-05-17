/** Внутренние ссылки с учётом Astro `base` (GitHub Pages project site). */
export function baseUrl(pathname: string): string {
  const base = import.meta.env.BASE_URL;
  if (!pathname || pathname === "/") return base;
  const tail = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return base + tail;
}
