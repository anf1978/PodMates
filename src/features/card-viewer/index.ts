// Card art views: View Deck, a Card Type Frequency row's cards, one card's art and the commander
// portraits above the radar. Callers pass the matched deck or entries; nothing reads page globals.
import "./card-viewer.css";
import { render } from "../../ui/html";
import { closeModal } from "../../ui/modal";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import {
  cachedOtherFaceUrl,
  fetchCardImagesBatch,
  fetchCardImageUrl,
} from "../../services/card-art";
import { on } from "../../services/events";
import { groupDeck, typeTiles, type ViewerTile } from "./state";
import {
  deckTemplate,
  heroTemplate,
  loadingTemplate,
  singleArtTemplate,
  typeTemplate,
} from "./view";
import type { CardRecord } from "../../cards/tuple";

const wideModal = { modalClass: "tad-modal tad-modal-wide" };

export async function showDeckViewer(
  matched: readonly { qty: number; card: Pick<CardRecord, "n" | "t"> }[],
  commanderNames: ReadonlySet<string>,
): Promise<void> {
  const { modal } = openTadOverlay(wideModal);
  render(loadingTemplate(), modal);
  // Group first (cheap, synchronous), so the grouping never depends on the network.
  const gallery = groupDeck(matched, commanderNames);
  const { urlMap, notFound } = await fetchCardImagesBatch(gallery.names);
  render(
    deckTemplate(matched.length, gallery.groups, urlMap, notFound.length, closeTryADeckModal),
    modal,
  );
}

/** Entries come from the same engine pass as the clicked count, so the two always agree. */
export async function showTypeCards(typeName: string, entries: readonly ViewerTile[]) {
  const { modal } = openTadOverlay(wideModal);
  render(loadingTemplate(), modal);
  const tiles = typeTiles(entries);
  const { urlMap, notFound } = await fetchCardImagesBatch(tiles.map((t) => t.name));
  render(typeTemplate(typeName, tiles, urlMap, notFound.length, closeTryADeckModal), modal);
}

/**
 * Stacks on top of whatever is open (a profile, Load a Deck) instead of replacing it, because card
 * names inside those dialogs open this.
 */
export async function showSingleCardArt(name: string): Promise<void> {
  const { overlay, modal } = openTadOverlay({
    stacked: true,
    id: "tadArtOverlay",
    modalStyle: "max-width:340px",
  });
  const close = () => closeModal(document.getElementById("tadArtOverlay"));
  render(singleArtTemplate(name, undefined, close), modal);
  const url = await fetchCardImageUrl(name, "normal", true);
  if (!overlay.isConnected) return; // closed before the fetch resolved
  const art = url ? { url, other: cachedOtherFaceUrl(name) } : null;
  render(singleArtTemplate(name, art, close), modal);
}

const heroRuns = new WeakMap<HTMLElement, number>();

/** Up to two commander portraits; a missing image just leaves its slot hidden. */
/** Draws the commander portraits above the radar whenever Deck Chart charts a deck. */
export function mountCommanderHero(): void {
  on("chart:commanders", (commanders) => {
    const area = document.getElementById("commanderHeroArea");
    if (area) void renderCommanderHero(area, commanders);
  });
}

export async function renderCommanderHero(area: HTMLElement, commanders: readonly string[]) {
  const run = (heroRuns.get(area) ?? 0) + 1;
  heroRuns.set(area, run);
  if (!commanders.length) {
    render(null, area);
    return;
  }
  const names = commanders.slice(0, 2);
  render(heroTemplate(names.map((name) => ({ name }))), area);
  const urls = await Promise.all(names.map((name) => fetchCardImageUrl(name, "normal")));
  if (heroRuns.get(area) !== run) return; // a newer chart replaced these commanders
  const slots = names.map((name, i) => ({ name, url: urls[i], other: cachedOtherFaceUrl(name) }));
  render(heroTemplate(slots), area);
}
