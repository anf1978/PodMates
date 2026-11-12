// Analyses one decklist against the page's card data, for the boundaries that chart several decks
// (comparison, Gatherings, Chronicles, profiles and the saved-deck tables). No side effects.
import { detectCommander } from "../engine/commanders";
import { pageContext, lookupIndexes } from "../services/card-data";
import { analyzeList } from "../services/deck-analysis";

export const analyzeOneList = (raw: string, player: string, commander: string) =>
  analyzeList(raw, player, commander, {
    context: pageContext(),
    indexes: lookupIndexes(),
    detectCommander,
  });
