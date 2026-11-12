// Shared pieces of the long explainer dialogs: titled sections and the breakdown table.

import { html, trustedHtml } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";

/** App-authored prose from explainer-prose.ts (only <strong> and <em>). */
export function prose(markup: string) {
  // Trusted: constant explainer text written in this repo; it holds no deck or user data.
  return trustedHtml(markup);
}

export function section(title: string, body: unknown): TemplateResult {
  // prettier-ignore
  return html`<div class="ex-section"><div class="ex-section-title">${title}</div><div>${body}</div></div>`;
}

/** A header row: first column left-aligned, the rest right-aligned. */
export function headRow(cells: readonly string[]): TemplateResult {
  // prettier-ignore
  return html`<tr class="ex-head">${cells.map((c, i) => html`<th class=${i === 0 ? "ex-th-first" : i === cells.length - 1 ? "ex-th-last" : "ex-th-mid"}>${c}</th>`)}</tr>`;
}

export function bodyRow(cells: readonly string[]): TemplateResult {
  // prettier-ignore
  return html`<tr>${cells.map((c, i) => html`<td class=${i === 0 ? "ex-td-first" : i === cells.length - 1 ? "ex-td-last" : "ex-td-mid"}>${c}</td>`)}</tr>`;
}

export const bodyWrap = (inner: unknown) => html`<div class="ex-body">${inner}</div>`;
