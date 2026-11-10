// Structure & Legality panel: the soft rule checks under the radar. The checks themselves
// live in ../state.ts; this file only turns a report into markup.

import { html, nothing } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import type { LegalityReport } from "../state.ts";

export function legalityTemplate(report: LegalityReport): TemplateResult {
  const hasBody = report.issues.length > 0 || report.notes.length > 0;
  return html`${
    report.issues.length
      ? html`<ul class="dc-legality-issues">
          ${report.issues.map((issue) => html`<li class="dc-legality-issue">${issue}</li>`)}
        </ul>`
      : nothing
  }${
    report.notes.length
      ? html`<div class="dc-legality-notes">${report.notes.join(" · ")}</div>`
      : nothing
  }${
    hasBody ? nothing : html`<div class="dc-legality-empty">No structural issues detected.</div>`
  }`;
}

/** The badge text shown in the panel's summary row. */
export function legalityBadgeText(report: LegalityReport): string {
  if (report.ok) return "Looks fine";
  return report.issues.length === 1 ? "1 note" : report.issues.length + " notes";
}
