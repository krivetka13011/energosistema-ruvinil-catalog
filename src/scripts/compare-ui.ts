import { getCompareItems, addToCompare, removeFromCompare } from "./compare-storage";

export function updateCompareButton(btn: HTMLButtonElement) {
  const slug = btn.dataset.slug;
  if (!slug) return;
  const isComp = getCompareItems().includes(slug);
  btn.setAttribute("aria-pressed", isComp.toString());
  const textEl = btn.querySelector("[data-compare-text]");
  if (textEl) {
    textEl.textContent = isComp ? "В сравнении" : "Добавить в сравнение";
  }
}

export function bindCompareButtons() {
  document.querySelectorAll<HTMLButtonElement>("[data-compare-btn]:not([data-compare-bound])").forEach((btn) => {
    btn.dataset.compareBound = "1";
    updateCompareButton(btn);
    btn.addEventListener("click", () => {
      const slug = btn.dataset.slug;
      if (!slug) return;
      if (btn.getAttribute("aria-pressed") === "true") {
        removeFromCompare(slug);
      } else {
        addToCompare(slug);
      }
    });
  });
}

function updateBadge() {
  const badge = document.getElementById("compare-badge");
  if (!badge) return;
  const len = getCompareItems().length;
  badge.textContent = String(len);
  badge.classList.toggle("hidden", len === 0);
}

export function initCompareUi() {
  bindCompareButtons();
  updateBadge();
  window.addEventListener("compare:updated", () => {
    document.querySelectorAll<HTMLButtonElement>("[data-compare-btn]").forEach(updateCompareButton);
    updateBadge();
  });
  document.addEventListener("astro:after-swap", () => {
    bindCompareButtons();
    updateBadge();
  });
}

initCompareUi();
