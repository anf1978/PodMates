// The one way to build DOM from templates (decision D2: lit-html). Features import
// from here, never from lit-html directly, so the escape hatch below stays auditable.

import { unsafeHTML } from "lit-html/directives/unsafe-html.js";

export { html, nothing, render, svg } from "lit-html";
export type { TemplateResult } from "lit-html";
export { classMap } from "lit-html/directives/class-map.js";
export { styleMap } from "lit-html/directives/style-map.js";

/**
 * Inserts a raw HTML string without escaping it.
 *
 * Allowed only for markup this app generated itself from constants or already
 * escaped values (for example legacy `escapeHtml(...)` strings while a panel is
 * being migrated). Never pass user, pod, deck or network text through it: use an
 * ordinary `html` binding, which escapes automatically.
 */
export function trustedHtml(markup: string) {
  return unsafeHTML(markup);
}
