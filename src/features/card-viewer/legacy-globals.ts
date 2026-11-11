// Strangler adapter for the still-inline deck form, chart and Key Pieces panel. It binds View Deck
// to the form and publishes only the names inline code still calls.
// TODO(p3-6): delete each name with its caller (the delegated card/type click handler).
import { parseDecklist } from "../../cards/parse-decklist.ts";
import { matchDecklist, type LookupIndexes } from "../../cards/lookup.ts";
import type { CardRecord } from "../../cards/tuple.ts";
import { parseCommanderField } from "../../engine/commanders.ts";
import { pageContext } from "../../engine/legacy-globals.ts";
import { showToast } from "../../ui/toast.ts";
import { currentChart } from "../../services/current-chart.ts";
import type { ViewerTile } from "./state.ts";
import { mountCommanderHero, showDeckViewer, showSingleCardArt, showTypeCards } from "./index.ts";

declare const dbReady: boolean;
declare const CARD_DB: CardRecord[];
declare const indexes: LookupIndexes;

function fieldValue(id: string): string {
  return (
    (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? ""
  );
}

document.getElementById("viewDeckBtn")?.addEventListener("click", () => {
  if (!dbReady) return showToast("Card database still loading — try again in a moment.");
  const parsed = parseDecklist(fieldValue("decklistInput"));
  if (!parsed.entries.length) return showToast("Paste a decklist first.");
  const { matched } = matchDecklist(parsed.entries, CARD_DB, indexes);
  if (!matched.length) return showToast("Could not read any cards from this decklist.");
  const commanders = parseCommanderField(pageContext(), fieldValue("commanderInput"));
  void showDeckViewer(matched, new Set(commanders));
});

mountCommanderHero();

const legacy = {
  showTypeCardsModal: (typeName: string): void => {
    const agg = currentChart().agg as { cardsByType?: Record<string, ViewerTile[]> } | null;
    const entries = agg?.cardsByType?.[typeName];
    if (entries) void showTypeCards(typeName, entries);
  },
  showSingleCardArtModal: (name: string): void => void showSingleCardArt(name),
};
type CardViewerLegacy = typeof legacy;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends CardViewerLegacy {}
}
Object.assign(window, legacy);
