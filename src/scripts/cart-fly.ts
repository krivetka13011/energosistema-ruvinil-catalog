/** Анимация «полёта» от кнопки добавления к иконке корзины в шапке. */
export function flyToCart(fromEl: HTMLElement) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const target =
    document.getElementById("header-cart-link") ??
    document.getElementById("cart-badge")?.closest("a");
  if (!target) return;

  const from = fromEl.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (from.width === 0 || to.width === 0) return;

  const dot = document.createElement("span");
  dot.className = "cart-fly-dot";
  dot.setAttribute("aria-hidden", "true");
  const size = 14;
  const x0 = from.left + from.width / 2 - size / 2;
  const y0 = from.top + from.height / 2 - size / 2;
  const x1 = to.left + to.width / 2 - size / 2;
  const y1 = to.top + to.height / 2 - size / 2;

  dot.style.left = `${x0}px`;
  dot.style.top = `${y0}px`;
  dot.style.width = `${size}px`;
  dot.style.height = `${size}px`;
  document.body.appendChild(dot);

  const dx = x1 - x0;
  const dy = y1 - y0;
  const anim = dot.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.2}px) scale(1.15)`, opacity: 0.95, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0 },
    ],
    { duration: 620, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "forwards" },
  );

  target.classList.add("cart-badge-pulse");
  const clearPulse = () => target.classList.remove("cart-badge-pulse");

  anim.onfinish = () => {
    dot.remove();
    clearPulse();
  };
  anim.oncancel = () => {
    dot.remove();
    clearPulse();
  };
  window.setTimeout(clearPulse, 800);
}
