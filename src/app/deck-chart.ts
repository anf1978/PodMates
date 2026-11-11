// Mounts Deck Chart with the page's card data and deck-form helpers, and registers Chart Deck as
// the shared chart runner (src/services/current-chart.ts).
import { mount } from "../features/deck-chart";
import type { InteractionTags, KnowledgeJson, KnowCard } from "../features/deck-chart/interactions";
import {
  availableSampleDecks,
  cardDb,
  interactionTags,
  isDbReady,
  knowledge,
  loadKnowledge,
  lookupIndexes,
} from "../services/card-data";
import { setChartRunner } from "../services/current-chart";
import { decklistProblem } from "../services/decklist-limits";
import { autoFillDeckName } from "../services/deck-form";

const chart = mount({
  dbReady: isDbReady,
  indexes: lookupIndexes,
  deckListProblem: (raw) => decklistProblem(raw),
  autoFillDeckName,
  availableSampleDecks: (decks) => availableSampleDecks(decks),
  cards: cardDb,
  tags: () => interactionTags() as InteractionTags,
  loadKnowledge,
  knowledge: () => {
    const { json, byName } = knowledge();
    return { json: json as KnowledgeJson, byName: byName as Map<string, KnowCard> };
  },
});

setChartRunner(chart.runAnalysis);
