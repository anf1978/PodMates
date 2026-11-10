// Deck Chart view helpers: the pieces several panels share. Panels own their own markup;
// this file only holds the render target lookup and small shared bits of template.

import { html, render } from "../../ui/html.ts";
import type { TemplateResult } from "../../ui/html.ts";

/** Renders a template into one of the result panels' containers, if the page has it. */
export function renderInto(id: string, template: unknown): HTMLElement | null {
  const target = document.getElementById(id);
  if (target) render(template, target);
  return target;
}

/**
 * The "?" button that opens a panel's explainer; the page listens for [data-explain].
 * Callers supply the separating space so the preceding label stays a single text node.
 */
export function explainerButton(key: string): TemplateResult {
  // prettier-ignore
  return html`<button class="info-btn" data-explain=${key} title="How is this calculated?">?</button>`;
}

/** One figure in a stats strip. */
export function stat(value: string | number, label: string): TemplateResult {
  return html`<div class="stat">
    <span class="num">${value}</span><span class="lbl">${label}</span>
  </div>`;
}

/** The collapsible "How did we build this?" footnote every panel ends with. */
export function howBuilt(summary: string, body: unknown): TemplateResult {
  return html`<details class="dc-how">
    <summary class="dc-how-summary">${summary}</summary>
    <div class="dc-how-body">${body}</div>
  </details>`;
}
