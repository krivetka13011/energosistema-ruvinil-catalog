import { getCompareItems } from "./compare-storage";

function updateBadge() {
  const badge = document.getElementById("compare-badge");
  if (!badge) return;
  const len = getCompareItems().length;
  badge.textContent = String(len);
  if (len > 0) {
    badge.classList.remove("hidden");
    badge.classList.add("inline-block");
  } else {
    badge.classList.add("hidden");
    badge.classList.remove("inline-block");
  }
}

updateBadge();
window.addEventListener("compare:updated", updateBadge);
document.addEventListener("astro:after-swap", updateBadge);
