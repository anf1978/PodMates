// Scan dialog templates; the page's delegated card-name listener still opens art.
import { html, type TemplateResult } from "../../ui/html";
import { cardNameLink } from "../../ui/card-name";
import type { ScanResult } from "./state";

export interface ScanActions {
  close(): void;
  photo(): void;
  rescan(): void;
  add(): void;
}

export function scanTemplate(actions: ScanActions, hasFiles: boolean): TemplateResult {
  return html`<div class="scan-head">
      <h2 class="scan-title">Scan Cards from Photo</h2>
      <button class="tad-close" id="tadCloseBtn" @click=${actions.close}>Close ×</button>
    </div>
    <p class="scan-subtitle">
      Reads card <strong>names only</strong>, not quantities. Cards you tick go to Deck Crafter.
    </p>
    <div class="row scan-photo-actions">
      <button id="scanCardsAddPhotoBtn" @click=${actions.photo}>Add a Photo…</button>
      <button id="scanCardsRescanBtn" class="ghost" ?disabled=${!hasFiles} @click=${actions.rescan}>
        Rescan Same Photo(s)
      </button>
    </div>
    <details class="scan-instructions">
      <summary>Tips for a good photo</summary>
      <ul>
        <li>Fan or stack cards so every name is fully visible and not overlapped</li>
        <li>Good, even lighting — avoid glare, especially on foils</li>
        <li>About 10–15 cards per photo works better than cramming in more</li>
        <li>Add several photos one at a time — results build up as you go</li>
        <li>
          Every match is a real card name found in the photo's text, but small text can miss a card
          or catch a stray name: check the list (tap a name to see its art)
        </li>
        <li>
          OCR reads a photo a little differently each time: <strong>Rescan Same Photo(s)</strong>
          often finds cards a first pass missed, and skips anything already found or in your deck
        </li>
      </ul>
    </details>
    <div id="scanCardsStatus" class="scan-status"></div>
    <div id="scanCardsResultsArea" class="scan-results"></div>
    <div id="scanCardsActionRow" class="scan-actions" hidden>
      <button id="scanCardsAddToDeckBtn" @click=${actions.add}>
        Add Checked Cards to Deck Crafter
      </button>
    </div>`;
}

export function resultsTemplate(
  results: readonly ScanResult[],
  check: (index: number, checked: boolean) => void,
): TemplateResult {
  if (!results.length)
    return html`<div class="scan-empty">
      No known card names found in that photo — try a closer, better-lit shot with fewer cards at
      once.
    </div>`;
  return html`${results.map(
    (result, index) =>
      html`<div class="scan-result">
        <input
          type="checkbox"
          data-scan-result-index=${index}
          .checked=${result.checked}
          @change=${(event: Event) => check(index, (event.currentTarget as HTMLInputElement).checked)}
        />
        <span class="scan-card-name">${cardNameLink(result.card.n)}</span>
      </div>`,
  )}`;
}
