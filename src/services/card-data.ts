// The page's card data: the card DB and lookup indexes, the Spellbook index, commander
// win-rates and Scryfall Tagger tags (filled once by bootCardData at start-up), plus the lazily
// loaded deck library and card knowledge. Features receive it through their ports; nothing here
// is published on `window`.
import type { LookupIndexes } from "../cards/lookup";
import { matchDecklist } from "../cards/lookup";
import { parseDecklist } from "../cards/parse-decklist";
import { cardPopularity, searchCards, type SearchOptions } from "../cards/search";
import type { CardRecord } from "../cards/tuple";
import { createEngineContext } from "../engine/context";
import type { CommanderTierRecord, EngineContext, SpellbookIndex } from "../engine/context";
import { loadDataset } from "../data/load-dataset";
import { html } from "../ui/html";
import { bootProgress, setBootStatus } from "./boot-status";
import { bootCardDatabase } from "./card-db-boot";

/** A Try-a-Deck library row; `awaitsCards` rows need their cards in this DB to be offered. */
export interface LibraryDeck {
  decklist: string;
  commander: string;
  awaitsCards?: boolean;
  validationDecklist?: string;
  [key: string]: unknown;
}

export interface InteractionTagSets {
  blink: Set<string>;
  extraCombat: Set<string>;
}

export interface CardKnowledge {
  json: { cards: Record<string, unknown> };
  byName: Map<string, unknown>;
}

let cards: CardRecord[] | undefined;
let indexes: LookupIndexes | null = null;
let ready = false;
let spellbook: SpellbookIndex | null = null;
let winRates: CommanderTierRecord[] | undefined;
let tags: InteractionTagSets | undefined;
let library: LibraryDeck[] | undefined;
let knowledgeJson: CardKnowledge["json"] | undefined;
const knowledgeByName = new Map<string, unknown>();
let libraryReady: Promise<void> | undefined;
let knowledgeReady: Promise<void> | undefined;
let databaseReady: Promise<void> | undefined;
let cachedContext: { key: readonly unknown[]; ctx: EngineContext } | null = null;

export const isDbReady = (): boolean => ready;
export const cardDb = (): CardRecord[] => cards ?? [];
export const lookupIndexes = (): LookupIndexes => indexes as LookupIndexes;
export const interactionTags = (): InteractionTagSets | undefined => tags;
export const knowledge = (): CardKnowledge => ({
  json: knowledgeJson as CardKnowledge["json"],
  byName: knowledgeByName,
});
/** The deck library, once loadDeckLibrary() has resolved. */
export const deckLibrary = (): LibraryDeck[] | undefined => library;

/** The engine context for the current data; rebuilt only when the DB, Spellbook or win-rates change. */
export function pageContext(): EngineContext {
  const key = [cardDb(), spellbook, winRates] as const;
  if (!cachedContext || cachedContext.key.some((v, i) => v !== key[i])) {
    cachedContext = {
      key,
      ctx: createEngineContext({ cards: key[0], spellbook, winRates }),
    };
  }
  return cachedContext.ctx;
}

/** Drops library decks whose cards this DB does not have yet (more than two unmatched). */
export function availableSampleDecks<D extends object>(decks: D[]): D[] {
  return decks.filter((deck) => {
    const o = deck as Partial<LibraryDeck>;
    return (
      !o.awaitsCards ||
      matchDecklist(
        parseDecklist(o.validationDecklist || o.decklist || "").entries,
        cardDb(),
        lookupIndexes(),
      ).notFound.length <= 2
    );
  });
}

/** A Try-a-Deck deck added recently (the precon importer stamps `addedAt`, a YYYY-MM-DD date). */
export interface NewSampleDeck {
  key: string;
  name: string;
  commander: string;
  addedAt: number;
}

/** Metadata rows whose `addedAt` date falls within the last `days` days (not in the future). */
export function recentlyAdded<D extends object>(decks: D[], now: number, days: number): D[] {
  return decks.filter((deck) => {
    const added = (deck as { addedAt?: unknown }).addedAt;
    const at = typeof added === "string" ? Date.parse(added) : NaN;
    return at <= now && now - at <= days * 86400000;
  });
}

/** Try-a-Deck decks added in the last `days` days that this card DB can offer, newest first. Uses
 * the deck metadata (no decklists), the same cached file the first chart loads. */
export async function loadNewSampleDecks(now: number, days = 30): Promise<NewSampleDeck[]> {
  const metadata = await loadDataset<LibraryDeck[]>("TRY_A_DECK_METADATA");
  const fresh = recentlyAdded(metadata, now, days);
  if (!fresh.length) return [];
  await databaseReady;
  if (!ready) return [];
  return availableSampleDecks(fresh)
    .map((deck) => ({
      key: String(deck.key || ""),
      name: String(deck.flavorName || deck.key || "A new deck"),
      commander: deck.commander,
      addedAt: Date.parse(String(deck.addedAt)),
    }))
    .filter((deck) => deck.key)
    .sort((a, b) => b.addedAt - a.addedAt);
}

export function loadDeckLibrary(): Promise<void> {
  return (libraryReady ||= (async () => {
    const decks = await loadDataset<LibraryDeck[]>("TRY_A_DECK_OPTIONS");
    await databaseReady;
    if (!ready) throw new Error("Card database is not ready.");
    library = availableSampleDecks(decks);
  })());
}

export function loadKnowledge(): Promise<void> {
  return (knowledgeReady ||= (async () => {
    knowledgeJson = await loadDataset<CardKnowledge["json"]>("KNOW_JSON");
    for (const [name, entry] of Object.entries(knowledgeJson.cards)) {
      knowledgeByName.set(name.toLowerCase(), entry);
    }
  })());
}

/** Ranked search over the loaded DB; [] until it is loaded. Library popularity once loaded. */
export function searchLoadedCards(query: string, limit: number, options?: SearchOptions | null) {
  if (!cards) return [];
  return searchCards(cards, library ? cardPopularity(library) : new Map(), query, limit, options);
}

/** Loads the deck library (card rankings), then searches. */
export async function searchPageCards(
  query: string,
  limit: number,
  options?: SearchOptions | null,
) {
  await loadDeckLibrary();
  return searchLoadedCards(query, limit, options);
}

export function findPageCard(name: string): CardRecord | undefined {
  return indexes ? indexes.byExactName.get(String(name).toLowerCase()) : undefined;
}

export const pageRankingsLoaded = (): boolean => !!library;

/** The source (src/ui/card-search.ts CardSearchSource) the card search boxes share. */
export const pageCardSource = {
  loaded: pageRankingsLoaded,
  ready: () => loadDeckLibrary(),
  search: (query: string, limit: number) => searchLoadedCards(query, limit),
  find: findPageCard,
  onLoadError: (error: unknown) => console.error(error),
};

const FAILURE_HINT =
  "On phones this is often a memory limit or a truncated download (file should be about " +
  "2.5 MB now). Try desktop, re-download, or close other apps/tabs.";

/** Loads the card DB, required datasets and optional Spellbook once; `onReady` runs when usable. */
export function bootCardData(onReady: () => void): Promise<void> {
  return (databaseReady ||= (async () => {
    try {
      await bootCardDatabase({
        progress: (stage, percent) => bootProgress(stage, percent),
        staticDatasets: (data) => {
          winRates = data.commanderTiers;
          tags = {
            blink: new Set(data.tags["blink"]),
            extraCombat: new Set(data.tags["extra-combat"]),
          };
        },
        database: (database) => {
          cards = database.cards;
          indexes = database.indexes;
        },
        loadingSpellbook: () => setBootStatus("", "Loading the combo snapshot…"),
        spellbook: (index) => {
          spellbook = index;
        },
        ready: (message) => {
          ready = true;
          setBootStatus("ok", message);
          onReady();
        },
      });
    } catch (e) {
      const raw = (e as { message?: unknown } | null)?.message;
      const error = raw ? String(raw) : "unknown";
      setBootStatus(
        "err",
        html`Database failed while initializing.<br /><br /><strong>Error:</strong
          >${` ${error}`}<br /><br />${FAILURE_HINT}`,
      );
      console.error(e);
    }
  })());
}
