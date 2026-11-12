// Messages after a chart: auto-corrected typos and unmatched names under the form, and the
// legality dialog for lists that break the official rules.

import { html, nothing, render } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { closeTryADeckModal, openTadOverlay } from "../../../ui/tad-modal.ts";

export interface FuzzyMatch {
  typed: string;
  matched: string;
}

export function notFoundTemplate(
  notFound: readonly string[],
  fuzzyMatches: readonly FuzzyMatch[],
): TemplateResult {
  const fuzzy = fuzzyMatches.length
    ? // prettier-ignore
      html`<div class="fuzzy-note">${`Auto-corrected ${fuzzyMatches.length} likely typo(s): ${fuzzyMatches.map((f) => `"${f.typed}" → "${f.matched}"`).join(", ")}`}</div>`
    : nothing;
  const missing = notFound.length
    ? // prettier-ignore
      html`<details class="not-found-box"><summary>${`${notFound.length} card${notFound.length > 1 ? "s" : ""} not found`}</summary><div class="rs-nf-list">${notFound.join(", ")}</div></details>`
    : nothing;
  return html`${fuzzy}${missing}`;
}

export function showLegalityPopup(hardViolations: readonly string[]): void {
  const { modal } = openTadOverlay();
  render(
    // prettier-ignore
    html`<button class="tad-close" id="tadCloseBtn" @click=${closeTryADeckModal}>Close ×</button><h2 class="rs-legal-title">Legality check</h2><p class="tad-sub">This decklist has been charted as usual — some pods don't care about official rules. But if you're playing sanctioned Commander, these would need fixing:</p><ul class="rs-legal-list">${hardViolations.map((v) => html`<li>${v}</li>`)}</ul>`,
    modal,
  );
}
