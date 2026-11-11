// Temporary ports for the unmoved pod refresh and Gathering battle-result callers.
import {
  configureChronicles,
  mount,
  refreshCloudChroniclesCache,
  renderMatchLog,
  runLogBattle,
  showFeedbackSurvey,
} from "./index";
import type { ChronicleBattle, ChronicleBattleDeck } from "./state";

declare const currentPodViewId: string | null;
declare const currentBattleContext: ChronicleBattle | null;
declare const lastPodDecks: ChronicleBattleDeck[] | null;
declare const renderBattleControls: () => void;
declare const requireAccountToSave: (what: string) => boolean;
declare const showConfirmModal: (message: string, action: () => Promise<void>) => void;
declare const showActionConfirmModal: (
  message: string,
  label: string,
  action: () => Promise<void>,
  cancel: null,
  cancelLabel: string,
) => void;

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
});

const legacy = {
  // TODO(p3-6): pod-scope/auth refresh callers remain inline.
  refreshCloudChroniclesCache,
  // TODO(p3-6): the legacy comparison renderer refreshes the journal.
  renderMatchLog,
  // TODO(p3-6): the legacy battle controls still invoke Log Battle.
  runLogBattle,
  // TODO(p3-6): Gathering battle-result callers still open the survey.
  showFeedbackSurvey,
};
type ChroniclesLegacy = typeof legacy;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends ChroniclesLegacy {}
}
Object.assign(window, legacy);
mount();
