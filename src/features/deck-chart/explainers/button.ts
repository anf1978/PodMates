// The small "?" button that opens a panel's explainer (handled by the delegated click in
// explainers/index.ts through its data-explain key).

import { escapeHtml } from "../../../ui/card-name.ts";
import { html } from "../../../ui/html.ts";

export function explainerButton(key: string) {
  // prettier-ignore
  return html` <button class="info-btn" data-explain=${key} title="How is this calculated?">?</button>`;
}

/** The same button as markup, for the still-inline panel builders. */
export function explainerButtonHtml(key: string): string {
  return ` <button class="info-btn" data-explain="${escapeHtml(key)}" title="How is this calculated?">?</button>`;
}
