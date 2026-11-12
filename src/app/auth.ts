// Mounts the account bar and sign-in dialog with the shared dialog primitives.
import { configureAuth, mount, updateAuthBar } from "../features/auth";
import { showActionConfirmModal } from "../ui/confirm";
import { closeTryADeckModal, openTadOverlay } from "../ui/tad-modal";

configureAuth({
  open: () => openTadOverlay().modal,
  close: () => closeTryADeckModal(),
  confirm: (message, label, action) => showActionConfirmModal(message, label, action),
});

mount();
// The cloud listener also updates the bar when Firebase settles.
updateAuthBar();
