// Temporary ports to unmoved modal helpers and exports for legacy save/invite callers.
import { configureAuth, mount, requireAccountToSave, updateAuthBar } from "./index";
import { openTadOverlay, closeTryADeckModal } from "../../ui/tad-modal";
import { showActionConfirmModal } from "../../ui/confirm";

configureAuth({
  open: () => openTadOverlay().modal,
  close: () => closeTryADeckModal(),
  confirm: (message, label, action) => showActionConfirmModal(message, label, action),
});

const legacy = {
  // TODO(p3-6): the saved-decks, profile and chronicles adapters still read this guard.
  requireAccountToSave,
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends AuthLegacy {}
}
type AuthLegacy = typeof legacy;
Object.assign(window, legacy);

mount();
// The cloud listener also updates the bar when Firebase settles.
updateAuthBar();
