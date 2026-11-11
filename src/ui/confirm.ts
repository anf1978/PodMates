// In-page confirm dialogs, deliberately NOT window.confirm(): that native dialog depends on the
// host app implementing it, and if it silently auto-resolved we could not tell a SAFE failure
// (nothing happens) from an UNSAFE one (deleting without ever asking).
import { html, render } from "./html";
import { closeTryADeckModal, openTadOverlay } from "./tad-modal";

/** A deletion confirm: Cancel / Delete. */
export function showConfirmModal(message: string, onConfirm: () => void): void {
  const { modal } = openTadOverlay();
  render(
    html`<p class="tad-confirm-text">${message}</p>
      <div class="row tad-confirm-actions">
        <button id="confirmModalCancelBtn" class="ghost" @click=${closeTryADeckModal}>
          Cancel
        </button>
        <button
          id="confirmModalOkBtn"
          class="ghost tad-confirm-danger"
          @click=${() => {
            closeTryADeckModal();
            onConfirm();
          }}
        >
          Delete
        </button>
      </div>`,
    modal,
  );
}

/**
 * A confirm with an explicit label for the real action ("Regenerate", "Make Steward", "Log Battle").
 * `onCancel` reopens whatever overlay this was opened from (an open Pod Profile, a pod detail
 * view); leave it unset when the confirm was opened from the ordinary page.
 */
export function showActionConfirmModal(
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  onCancel?: (() => void) | null,
  cancelLabel?: string,
): void {
  const cancel = () => {
    closeTryADeckModal();
    if (onCancel) onCancel();
  };
  const { modal } = openTadOverlay({ onDismiss: cancel });
  render(
    html`<p class="tad-confirm-text">${message}</p>
      <div class="row tad-confirm-actions">
        <button id="actionConfirmCancelBtn" class="ghost" @click=${cancel}>
          ${cancelLabel || "Cancel"}
        </button>
        <button
          id="actionConfirmOkBtn"
          @click=${() => {
            closeTryADeckModal();
            onConfirm();
          }}
        >
          ${confirmLabel}
        </button>
      </div>`,
    modal,
  );
}
