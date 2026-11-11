// Temporary ports for the unmoved pod refresh and Gathering battle-result callers.
import { configureChronicles, mount, refreshCloudChroniclesCache, renderMatchLog } from "./index";
import { renderBattleControls, startResultsPolling, stopResultsPolling } from "./battle";
import type { ChronicleBattle, ChronicleBattleDeck } from "./state";
import { showActionConfirmModal, showConfirmModal } from "../../ui/confirm";

declare const currentPodViewId: string | null;
declare let currentBattleContext: ChronicleBattle | null;
declare let lastPodDecks: ChronicleBattleDeck[] | null;
declare const dbReady: boolean;
declare const analyzeOneList: (
  list: string,
  player: string,
  commander: string,
) => ChronicleBattleDeck | null;
declare const POD_COLORS: readonly string[];
declare const renderPodAnalysisResults: (decks: ChronicleBattleDeck[]) => void;
declare const openLiveGatheringOverlay: (podId: string, gatheringId: string) => void;
declare const requireAccountToSave: (what: string) => boolean;

configureChronicles({
  podId: () => currentPodViewId,
  requireAccount: (what) => requireAccountToSave(what),
  confirm: (message, action) => showConfirmModal(message, action),
  confirmDelete: (message, action) =>
    showActionConfirmModal(message, "Yes, delete", action, null, "No"),
  battle: () =>
    currentBattleContext && lastPodDecks
      ? { context: currentBattleContext, decks: lastPodDecks }
      : null,
  battleLogged: (context, chronicleId) => {
    context.loggedChronicleId = chronicleId;
    if (currentBattleContext !== context) return false;
    renderBattleControls();
    return true;
  },
  context: () => currentBattleContext,
  setContext: (context) => {
    currentBattleContext = context;
  },
  clearDecks: () => {
    lastPodDecks = null;
  },
  ready: () => dbReady,
  analyze: (list, player, commander) => analyzeOneList(list, player, commander),
  colors: POD_COLORS,
  results: (decks) => renderPodAnalysisResults(decks),
  openGathering: (podId, gatheringId) => openLiveGatheringOverlay(podId, gatheringId),
  confirmAction: (message, label, action) =>
    showActionConfirmModal(message, label, action, null, "Cancel"),
});

const legacy = {
  // TODO(p3-6): pod-scope/auth refresh callers remain inline.
  refreshCloudChroniclesCache,
  // TODO(p3-6): the legacy comparison renderer refreshes the journal.
  renderMatchLog,
  // TODO(p3-6): Gathering/comparison callers still draw the current battle controls.
  renderBattleControls,
  // TODO(p3-6): Gathering/comparison callers still start result watching.
  startResultsPolling,
  // TODO(p3-6): comparison mode changes still stop result watching.
  stopResultsPolling,
};
type ChroniclesLegacy = typeof legacy;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends ChroniclesLegacy {}
}
Object.assign(window, legacy);
mount();
