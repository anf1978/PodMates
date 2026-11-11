// Strangler shim: publishes the extracted card modules on `window` under exactly the
// names the inline legacy scripts in index.html still call, so moving the code out of
// the HTML changed nothing. Add no behaviour here; delete it with the last caller.
//
// It also bridges the page's card DB and deck library (still inline globals) to the ranked
// search for the feature adapters, so features never read those globals themselves.
// TODO(p3-6): replace the bridge when the page's card-DB and deck-library globals move.

import { fuzzyFindCard, matchDecklist } from "./lookup.ts";
import { parseDecklist } from "./parse-decklist.ts";
import { cardPopularity, searchCards, type SearchOptions } from "./search.ts";
import type { CardRecord } from "./tuple.ts";

declare const CARD_DB: CardRecord[] | undefined;
declare const TRY_A_DECK_OPTIONS: { decklist?: string }[] | undefined;
declare const indexes: { byExactName: Map<string, CardRecord> } | null;
declare function loadDeckLibrary(): Promise<void>;

/** Ranked search over the loaded DB; [] until the DB is loaded. Library popularity when loaded. */
export function searchLoadedCards(query: string, limit: number, options?: SearchOptions | null) {
  if (typeof CARD_DB === "undefined" || !CARD_DB) return [];
  const decks = typeof TRY_A_DECK_OPTIONS !== "undefined" && TRY_A_DECK_OPTIONS;
  return searchCards(CARD_DB, decks ? cardPopularity(decks) : new Map(), query, limit, options);
}

/** Loads the shared deck library (card rankings), then searches. */
export async function searchPageCards(
  query: string,
  limit: number,
  options?: SearchOptions | null,
) {
  await loadDeckLibrary();
  return searchLoadedCards(query, limit, options);
}

export function findPageCard(name: string): CardRecord | undefined {
  return typeof indexes !== "undefined" && indexes
    ? indexes.byExactName.get(String(name).toLowerCase())
    : undefined;
}

export const pageRankingsLoaded = () =>
  typeof TRY_A_DECK_OPTIONS !== "undefined" && !!TRY_A_DECK_OPTIONS;

/** The source (src/ui/card-search.ts CardSearchSource) every legacy-wired card search box shares. */
export const pageCardSource = {
  loaded: pageRankingsLoaded,
  ready: () => loadDeckLibrary(),
  search: (query: string, limit: number) => searchLoadedCards(query, limit),
  find: findPageCard,
  onLoadError: (error: unknown) => console.error(error),
};

declare global {
  interface Window {
    parseDecklist: typeof parseDecklist;
    fuzzyFindCard: typeof fuzzyFindCard;
    matchDecklist: typeof matchDecklist;
  }
}

window.parseDecklist = parseDecklist;
window.fuzzyFindCard = fuzzyFindCard;
window.matchDecklist = matchDecklist;
