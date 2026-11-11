// Temporary ports for inline saved-deck analysis, mode switching and battle state.
import { mount, type ComparisonDeck } from "./index";
import { analyzeList, POD_COLORS, type AnalysisInput } from "../../services/deck-analysis";
import { pageContext } from "../../engine/legacy-globals";
import { detectCommander } from "../../engine/commanders";
import {
  archetypeMatch,
  loadAnalysisDatasets,
  type SampleDeck,
} from "../../services/reference-data";
declare const indexes: AnalysisInput["indexes"];
declare function availableSampleDecks(decks: SampleDeck[]): SampleDeck[];
declare let lastPodDecks: ComparisonDeck[] | null;
declare const renderMatchLog: () => void;

const view = mount(document.getElementById("podResultsSection")!, {
  loadDatasets: () => loadAnalysisDatasets(availableSampleDecks),
  archetype: (deck) => archetypeMatch(deck.agg),
});
const legacy = {
  // TODO(p3-6): saved-deck table and existing profile/Gathering adapters still call this.
  analyzeOneList: (raw: string, player: string, commander: string): ComparisonDeck | null =>
    analyzeList(raw, player, commander, { context: pageContext(), indexes, detectCommander }),
  // TODO(p3-6): existing profile/Gathering adapters still read the six seat colours.
  POD_COLORS,
  // TODO(p3-6): battle adapters still hand their results to the comparison entry point.
  renderPodAnalysisResults: (decks: ComparisonDeck[]): { avgSpark: number; spread: number } => {
    decks.sort((a, b) => b.commandSpark - a.commandSpark);
    lastPodDecks = decks;
    const result = view.show(lastPodDecks);
    renderMatchLog();
    return result;
  },
};
type ComparisonLegacy = typeof legacy;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends ComparisonLegacy {}
}
Object.assign(window, legacy);
