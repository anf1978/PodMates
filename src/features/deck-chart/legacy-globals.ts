// Strangler shim: mounts Deck Chart with the page data the inline app script still owns (card DB,
// lookup indexes, tags, knowledge, deck form helpers), registers Chart Deck as the shared chart
// runner and publishes the one name the inline setMode still calls. No behaviour lives here.

import type { LookupIndexes } from "../../cards/lookup.ts";
import type { CardRecord } from "../../cards/tuple.ts";
import { currentChart, setChartRunner } from "../../services/current-chart.ts";
import { decklistProblem } from "../../services/decklist-limits.ts";
import type { SampleDeck } from "../../services/reference-data.ts";
import { mount } from "./index.ts";
import type { InteractionTags, KnowCard, KnowledgeJson } from "./interactions/index.ts";

// Page data owned by the inline boot adapter, lazy loaders and deck form (index.html).
declare const dbReady: boolean;
declare const indexes: LookupIndexes;
declare const CARD_DB: CardRecord[];
declare const IX_TAGS: InteractionTags;
declare const KNOW_JSON: KnowledgeJson;
declare const KNOW_MAP: Map<string, KnowCard>;
declare function loadKnowledge(): Promise<void>;
declare function autoFillDeckName(): void;
declare function availableSampleDecks(decks: SampleDeck[]): SampleDeck[];

const chart = mount({
  dbReady: () => dbReady,
  indexes: () => indexes,
  deckListProblem: (raw) => decklistProblem(raw),
  autoFillDeckName: () => autoFillDeckName(),
  availableSampleDecks: (decks) => availableSampleDecks(decks),
  cards: () => CARD_DB,
  tags: () => IX_TAGS,
  loadKnowledge: () => loadKnowledge(),
  knowledge: () => ({ json: KNOW_JSON, byName: KNOW_MAP }),
});

setChartRunner(chart.runAnalysis);

const legacy = {
  // TODO(p3-6): the inline setMode shows the results only after a single deck was charted.
  hasChartResult: (): boolean => currentChart().hasResult,
};

type LegacyDeckChart = typeof legacy;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends LegacyDeckChart {}
}

Object.assign(window, legacy);
