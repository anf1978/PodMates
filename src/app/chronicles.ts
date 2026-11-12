// Supplies Chronicles with the active pod, the account guard, the current battle and the battle
// analysis. The sign-in refresh is src/app/chronicles-auth.ts.
import { requireAccountToSave } from "../features/auth";
import { configureChronicles, mount } from "../features/chronicles";
import type { ComparisonDeck } from "../features/comparison";
import { openLiveGatheringOverlay } from "../features/gatherings";
import { isDbReady } from "../services/card-data";
import { POD_COLORS } from "../services/deck-analysis";
import { showActionConfirmModal, showConfirmModal } from "../ui/confirm";
import { renderBattleControls } from "../features/chronicles/battle";
import { activePodId } from "./active-pod";
import { analyzeOneList } from "./analysis";
import { battleContext, clearPodDecks, podDecks, setBattleContext, showPodResults } from "./battle";

configureChronicles({
  podId: activePodId,
  requireAccount: (what) => requireAccountToSave(what),
  confirm: (message, action) => showConfirmModal(message, action),
  confirmDelete: (message, action) =>
    showActionConfirmModal(message, "Yes, delete", action, null, "No"),
  battle: () => {
    const context = battleContext();
    const decks = podDecks();
    return context && decks ? { context, decks } : null;
  },
  battleLogged: (context, chronicleId) => {
    context.loggedChronicleId = chronicleId;
    if (battleContext() !== context) return false;
    renderBattleControls();
    return true;
  },
  context: battleContext,
  setContext: setBattleContext,
  clearDecks: clearPodDecks,
  ready: isDbReady,
  analyze: (list, player, commander) => analyzeOneList(list, player, commander),
  colors: POD_COLORS,
  results: (decks) => void showPodResults(decks as ComparisonDeck[]),
  openGathering: (podId, gatheringId) => void openLiveGatheringOverlay(podId, gatheringId),
  confirmAction: (message, label, action) =>
    showActionConfirmModal(message, label, action, null, "Cancel"),
});

mount();
