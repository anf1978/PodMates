// Mounts the Pod Comparison and registers it as the battle results view (src/app/battle.ts).
import { mount } from "../features/comparison";
import { availableSampleDecks } from "../services/card-data";
import { archetypeMatch, loadAnalysisDatasets } from "../services/reference-data";
import { provideComparisonView } from "./battle";

provideComparisonView(
  mount(document.getElementById("podResultsSection")!, {
    loadDatasets: () => loadAnalysisDatasets(availableSampleDecks),
    archetype: (deck) => archetypeMatch(deck.agg),
  }),
);
