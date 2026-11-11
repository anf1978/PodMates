// Temporary ports to unmoved comparison, saved-deck and battle callers.
import {
  configureGatherings,
  mount,
  openLiveGatheringOverlay,
  runSampleGathering,
  type GatheringRuntime,
} from "./index";
import { emit } from "../../services/events";
import { showActionConfirmModal } from "../../ui/confirm";
import type { BattleContext, ChartDeck } from "./runtime";

declare const dbReady: boolean;
declare const loadDeckLibrary: () => Promise<void>;
declare const TRY_A_DECK_OPTIONS: Awaited<ReturnType<GatheringRuntime["library"]>>;
declare const analyzeOneList: GatheringRuntime["analyze"];
declare const POD_COLORS: readonly string[];
declare const renderPodAnalysisResults: (decks: ChartDeck[]) => void;
declare const renderBattleControls: () => void;
declare const startResultsPolling: () => void;
declare const setMode: (mode: string) => void;
declare global {
  var currentBattleContext: BattleContext | null;
}

configureGatherings({
  ready: () => dbReady,
  library: async () => {
    await loadDeckLibrary();
    return TRY_A_DECK_OPTIONS;
  },
  analyze: (list, player, commander) => analyzeOneList(list, player, commander),
  colors: POD_COLORS,
  results: (decks, context) => {
    currentBattleContext = context;
    if (!context) setMode("pod");
    renderPodAnalysisResults(decks);
    renderBattleControls();
    if (context) startResultsPolling();
  },
  refreshPods: () => emit("pods:refresh", undefined),
  confirm: (...args) => showActionConfirmModal(...args),
  pickDeck: (target) => emit("decks:pick", target),
});

const legacy = {
  // TODO(p3-6): Chronicles and the deck picker still open the live tray.
  openLiveGatheringOverlay,
  // TODO(p3-6): the offline browser entry-point test still invokes this legacy name.
  runSampleGathering,
};
declare global {
  interface Window {
    openLiveGatheringOverlay: typeof openLiveGatheringOverlay;
    runSampleGathering: typeof runSampleGathering;
  }
}
Object.assign(window, legacy);
mount();
