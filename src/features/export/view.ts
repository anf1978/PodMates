// The export dialog uses text/property bindings, never markup made from card names.
import { html, type TemplateResult } from "../../ui/html";

export function exportTemplate(
  text: string,
  close: () => void,
  copy: () => Promise<void>,
): TemplateResult {
  return html` <button class="tad-close" id="tadCloseBtn" @click=${close}>Close ×</button>
    <h2 class="export-title">Export for Archidekt/Moxfield</h2>
    <p class="export-description">
      Copy this and paste it straight into either site's text/bulk importer -- both read this same
      "Commander" + "Deck" section format.
    </p>
    <textarea readonly class="export-text" .value=${text}></textarea>
    <div class="row export-actions">
      <button id="exportCopyBtn" @click=${copy}>Copy to Clipboard</button>
    </div>
    <div id="exportCopyStatus" class="export-status"></div>`;
}
