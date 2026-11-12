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
  return html` <button class="tad-close" id="tadCloseBtn" @click=${actions.close}>Close ×</button>
    <h2 class="scan-title">Scan Cards from Photo</h2>
    <p class="scan-subtitle">Cards you tick are added to your Deck Crafter list.</p>
    <div class="scan-instructions">
      <p>
        This reads card <strong>names only</strong> from a photo — it can't read quantities, so add
        basics or extra copies yourself afterward.
      </p>
      <p><strong>For best results:</strong></p>
      <ul>
        <li>Fan or stack cards so every name is fully visible and not overlapped</li>
        <li>Good, even lighting — avoid glare, especially on foils</li>
        <li>About 10–15 cards per photo works better than cramming in more</li>
        <li>Add several photos one at a time — results build up as you go</li>
      </ul>
      <p>
        Every match below is a
        <strong>real card name found somewhere in your photo's text</strong> — a photo with a lot of
        small text (rules text, symbols) can still miss cards or occasionally catch a stray name, so
        check the list (click a name to see its art) before adding it to your deck.
      </p>
      <p>
        OCR doesn't read the same photo the same way twice —
        <strong>Rescan Same Photo(s)</strong> re-reads whatever you last scanned without needing to
        pick the file again, and anything already found (or already in your decklist) is
        automatically skipped, so a few rescans of one photo often catches cards a single pass
        missed.
      </p>
    </div>
    <div class="row scan-photo-actions">
      <button id="scanCardsAddPhotoBtn" class="ghost" @click=${actions.photo}>Add a Photo…</button>
      <button id="scanCardsRescanBtn" class="ghost" ?disabled=${!hasFiles} @click=${actions.rescan}>
        Rescan Same Photo(s)
      </button>
    </div>
    <div id="scanCardsStatus" class="scan-status"></div>
    <div id="scanCardsResultsArea"></div>
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
