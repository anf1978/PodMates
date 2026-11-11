// The shared read-only info dialog (explainers, Game Changer reasons, symbol keys): a Close
// button, a heading and a body in the base dialog.

import { html, render } from "./html.ts";
import type { TemplateResult } from "./html.ts";
import { closeTryADeckModal, openTadOverlay } from "./tad-modal.ts";

export function showInfoModal(header: TemplateResult, body: TemplateResult): void {
  const { modal } = openTadOverlay({ modalStyle: "max-width:460px" });
  // prettier-ignore
  render(html`<button class="tad-close" id="tadCloseBtn">Close ×</button>${header}${body}`, modal);
  modal.querySelector("#tadCloseBtn")?.addEventListener("click", closeTryADeckModal);
}
