// Delegated clicks for card faces (flip), card names and type rows anywhere on the page.
// Registered before the other modules' document listeners, as the inline handler was.
import { showSingleCardArt, showTypeCards } from "../features/card-viewer";
import type { ViewerTile } from "../features/card-viewer/state";
import { currentChart } from "../services/current-chart";
import { safeHttpUrl } from "../services/safe-url";

function showTypeCardsFor(typeName: string): void {
  const agg = currentChart().agg as { cardsByType?: Record<string, ViewerTile[]> } | null;
  const entries = agg?.cardsByType?.[typeName];
  if (entries) void showTypeCards(typeName, entries);
}

// [data-go-key-pieces], [data-explain] and [data-gc-card] are handled in
// src/features/deck-chart/explainers, in this same precedence order; they are skipped here so one
// click never does two things.
document.addEventListener("click", (e) => {
  const target = e.target as Element | null;
  if (!target?.closest) return;
  if (target.closest("[data-go-key-pieces], [data-explain]")) return;
  const flip = target.closest<HTMLElement>("[data-flip-btn]");
  if (flip) {
    let host = flip.parentElement;
    let img: HTMLImageElement | null = null;
    while (host && !(img = host.querySelector("img"))) host = host.parentElement;
    if (img) {
      const cur = img.getAttribute("src");
      img.setAttribute("src", safeHttpUrl(flip.dataset.alt));
      flip.dataset.alt = String(cur);
    }
    return;
  }
  if (target.closest("[data-gc-card]")) return;
  const cardName = target.closest("[data-card-name]");
  if (cardName) {
    void showSingleCardArt(cardName.getAttribute("data-card-name")!);
    return;
  }
  const typeRow = target.closest("[data-type-name]");
  if (typeRow) showTypeCardsFor(typeRow.getAttribute("data-type-name")!);
});
