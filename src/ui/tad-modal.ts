// Shared legacy-shaped dialogs; feature modules use this without depending on Try-a-Deck.
import { closeModal, openModal, type ModalHandle, type ModalOptions } from "./modal";

export interface TadOptions {
  stacked?: boolean;
  id?: string;
  modalClass?: string;
  modalId?: string;
  modalStyle?: string;
  onDismiss?: ModalOptions["onDismiss"];
}

export function closeTryADeckModal(): void {
  closeModal(document.getElementById("tadOverlay"));
  document.querySelectorAll(".tad-stacked-overlay").forEach(closeModal);
}

export function openTadOverlay(options: TadOptions = {}): {
  overlay: HTMLElement;
  modal: HTMLElement;
  handle: ModalHandle;
} {
  if (options.stacked) closeModal(document.getElementById(options.id ?? ""));
  else closeTryADeckModal();
  const handle = openModal({
    overlayClass: options.stacked ? "tad-overlay tad-stacked-overlay" : "tad-overlay",
    overlayId: options.id || "tadOverlay",
    // Stacked dialogs must clear the icon tooltips (9999), as before.
    overlayStyle: options.stacked ? "z-index:10001" : undefined,
    modalClass: options.modalClass || "tad-modal",
    modalId: options.modalId,
    modalStyle: options.modalStyle,
    onDismiss:
      options.onDismiss ||
      (options.stacked ? (_reason, layer) => layer.close() : closeTryADeckModal),
  });
  return { overlay: handle.overlay, modal: handle.dialog, handle };
}
