// Strangler shim: publishes the UI primitives on `window` for the inline legacy scripts
// in index.html. `window.pmUi` is the typed surface; the other names are exactly the
// functions those scripts already call. Add no behaviour here; delete it with the last caller.

import { closeAllModals, closeModal, openModal, openModals } from "./modal.ts";
import { setStatusText } from "./status.ts";
import { selectTab, tabsByAttribute } from "./tabs.ts";
import { showToast } from "./toast.ts";
import { setupIconTooltips } from "./tooltip.ts";
import { openTadOverlay, closeTryADeckModal } from "./tad-modal";

const pmUi = Object.freeze({
  openModal,
  closeModal,
  openModals,
  closeAllModals,
  selectTab,
  tabsByAttribute,
});

declare global {
  interface Window {
    pmUi: typeof pmUi;
    showToast: (message: string) => void;
    setStatus: (message: string, isError?: unknown) => void;
    setDeckMgmtStatus: (message: string, isError?: unknown) => void;
    setupIconTooltipsFor: (scope?: ParentNode | null) => void;
    // TODO(p3-6): drop with the last unmoved legacy modal caller.
    openTadOverlay: typeof openTadOverlay;
    // TODO(p3-6): drop with the last unmoved legacy modal caller.
    closeTryADeckModal: typeof closeTryADeckModal;
  }
}

window.pmUi = pmUi;
window.showToast = (message) => showToast(message);
window.setStatus = (message, isError) =>
  setStatusText(document.getElementById("status"), message, isError);
window.setDeckMgmtStatus = (message, isError) =>
  setStatusText(document.getElementById("deckMgmtStatus"), message, isError);
window.setupIconTooltipsFor = (scope) => setupIconTooltips(scope ?? document);
window.openTadOverlay = openTadOverlay;
window.closeTryADeckModal = closeTryADeckModal;
