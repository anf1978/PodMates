// Temporary ports to unmoved pod, comparison, saved-deck and notification callers.
import {
  configureGatherings,
  mount,
  openHostGatheringOverlay,
  openLiveGatheringOverlay,
  openGatheringSeatDeckPicker,
  paintOpenGatherings,
  renderLiveGatheringTray,
  runSampleGathering,
  stopGatheringPolling,
  gatheringRsvp,
  type GatheringRuntime,
} from "./index";
import type { BattleContext, ChartDeck } from "./runtime";

declare const dbReady: boolean;
declare const loadDeckLibrary: () => Promise<void>;
declare const TRY_A_DECK_OPTIONS: Awaited<ReturnType<GatheringRuntime["library"]>>;
declare const analyzeOneList: GatheringRuntime["analyze"];
declare const POD_COLORS: readonly string[];
declare const renderPodAnalysisResults: (decks: ChartDeck[]) => void;
declare const renderBattleControls: () => void;
declare const startResultsPolling: () => void;
declare const renderOurPodPanel: () => void;
declare const setMode: (mode: string) => void;
declare const showActionConfirmModal: GatheringRuntime["confirm"];
declare const showLoadDeckModal: GatheringRuntime["pickDeck"];
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
  refreshPods: () => renderOurPodPanel(),
  confirm: (...args) => showActionConfirmModal(...args),
  pickDeck: (target) => showLoadDeckModal(target),
});

const legacy = {
  // TODO(p3-6): the pod detail view still opens host setup.
  openHostGatheringOverlay,
  // TODO(p3-6): pods, notifications and the deck picker still open the live tray.
  openLiveGatheringOverlay,
  // TODO(p3-6): the My Pods sample button is still inline.
  runSampleGathering,
  // TODO(p3-6): the pod landing list still hands over open gatherings.
  paintOpenGatherings,
};
// These are module exports for later migration, not additional window publications.
export {
  openGatheringSeatDeckPicker,
  renderLiveGatheringTray,
  stopGatheringPolling,
  gatheringRsvp,
};
type Legacy = typeof legacy;
declare global {
  interface Window extends Legacy {}
}
Object.assign(window, legacy);
mount();
