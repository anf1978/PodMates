// Commander Track Record: Playgroup.gg tier, win rate and rank for each commander, and how this
// build's Spark compares with that history.

import type { CommanderTierRecord } from "../../../engine/context.ts";
import type { SparkDiscrepancy } from "../../../engine/commander-tiers.ts";
import { html, nothing } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { EXPLAINERS } from "../explainers/explainer-text.ts";

const DISCREPANCY: Record<SparkDiscrepancy["direction"], { cls: string; label: string }> = {
  underbuilt: { cls: "tr-under", label: "Underbuilt for this commander" },
  overbuilt: { cls: "tr-over", label: "Overbuilt for this commander" },
  matched: { cls: "tr-matched", label: "Matches this commander’s track record" },
};

const TIERS = new Set(["S", "A", "B", "C", "D"]);

function about(): TemplateResult {
  return html`<details class="dc-how">
    <summary class="dc-how-summary">What is this?</summary>
    <div class="dc-how-body">${EXPLAINERS.commanderTrackRecord}</div>
  </details>`;
}

export function trackRecordTemplate(
  tierRecords: readonly CommanderTierRecord[] | null | undefined,
  discrepancy: SparkDiscrepancy | null | undefined,
  trackedCommanders: number,
): TemplateResult {
  if (!tierRecords || tierRecords.length === 0)
    // prettier-ignore
    return html`<div class="tr-empty">
      No empirical track record available for this commander — either it hasn't reached the 250-game / 10-pilot minimum sample yet, or it isn't one of the 1,284 commanders currently tracked.
    </div>${about()}`;
  const rows = tierRecords.map(
    (rec) =>
      // prettier-ignore
      html`<div class="tr-row">
      <div class=${"tr-tier" + (TIERS.has(rec.t) ? " tr-tier-" + rec.t : "")}>${rec.t}</div>
      <div class="tr-main">
        <div class="tr-name">${rec.n}</div>
        <div class="tr-stats">${`${rec.w.toFixed(1)}% win rate · ${rec.g.toLocaleString()} tracked games · ranked #${String(rec.r)} of ${trackedCommanders.toLocaleString()}`}</div>
      </div>
    </div>`,
  );
  const d = discrepancy ? DISCREPANCY[discrepancy.direction] : null;
  // prettier-ignore
  const disc = discrepancy && d ? html`
    <div class=${"tr-disc " + d.cls}>
      <strong class="tr-disc-label">${d.label}</strong><br>${"\n      " + discrepancy.detail + "\n    "}</div>` : nothing;
  return html`${rows}${disc}${about()}`;
}
