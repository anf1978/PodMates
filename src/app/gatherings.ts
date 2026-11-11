// Supplies Gatherings with the deck library, analysis, battle results and pod refresh.
import { renderBattleControls, startResultsPolling } from "../features/chronicles/battle";
import type { ComparisonDeck } from "../features/comparison";
import { configureGatherings, mount, type GatheringRuntime } from "../features/gatherings";
import { deckLibrary, isDbReady, loadDeckLibrary } from "../services/card-data";
import { POD_COLORS } from "../services/deck-analysis";
import { emit } from "../services/events";
import { showActionConfirmModal } from "../ui/confirm";
import { analyzeOneList } from "./analysis";
import { setBattleContext, showPodResults } from "./battle";
import { setMode } from "./mode";

type Library = Awaited<ReturnType<GatheringRuntime["library"]>>;

configureGatherings({
  ready: isDbReady,
  library: async () => {
    await loadDeckLibrary();
    return deckLibrary() as unknown as Library;
  },
  analyze: (list, player, commander) =>
    analyzeOneList(list, player, commander) as unknown as ReturnType<GatheringRuntime["analyze"]>,
  colors: POD_COLORS,
  results: (decks, context) => {
    setBattleContext(context);
    if (!context) setMode("pod");
    showPodResults(decks as ComparisonDeck[]);
    renderBattleControls();
    if (context) startResultsPolling();
  },
  refreshPods: () => emit("pods:refresh", undefined),
  confirm: (...args) => showActionConfirmModal(...args),
  pickDeck: (target) => emit("decks:pick", target),
});

mount();
