// The Commander Centrality explainer: what the reading means, this deck's five signals and the
// commander rules the scoring relies on.

import { CENTRALITY_WEIGHTS, COMMANDER_RULES } from "../../../engine/centrality-rules.ts";
import { html, nothing } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import * as P from "../explainers/explainer-prose.ts";
import { bodyRow, bodyWrap, headRow, prose, section } from "../explainers/layout.ts";
import type { Centrality } from "./panel.ts";

const SIGNALS = [
  ["plan", "Plan involvement"],
  ["engine", "Synergy reliance"],
  ["alignment", "Deck alignment"],
  ["ability", "Ability type"],
  ["investment", "Builder investment"],
] as const;

function table(r: Centrality): TemplateResult {
  const rows = SIGNALS.map(([k, label]) => {
    const v = r.components[k];
    return bodyRow([
      label,
      String(v === null || v === undefined ? "n/a" : Math.round(v * 100)),
      "×" + CENTRALITY_WEIGHTS[k],
    ]);
  });
  // prettier-ignore
  return html`<table class="ex-table"><tbody>${headRow(["Signal", "This deck (0–100)", "Weight"])}${rows}<tr class="ex-total"><td class="ex-tot-first">Centrality</td><td class="ex-tot-mid">${String(r.score)}</td><td></td></tr></tbody></table><div class="ex-note">If a signal is n/a (for example, no combos were detected), the others are re-weighted to fill its share.</div>`;
}

export function centralityExplainer(r: Centrality | null): TemplateResult {
  // prettier-ignore
  return bodyWrap(html`<div>${prose(P.CC_INTRO)}</div>${section(P.CC_GRID_TITLE, prose(P.CC_GRID))}${section(P.CC_CALC_TITLE, html`${P.CC_CALC}${r ? table(r) : nothing}`)}${section(P.CC_SIGNALS_TITLE, prose(P.CC_SIGNALS))}${section(P.CC_LIMITS_TITLE, prose(P.CC_LIMITS))}${section(P.CC_RULES_TITLE, html`<ul class="ex-rules">${COMMANDER_RULES.map((x) => html`<li class="ex-rule">${x.rule}</li>`)}</ul>`)}`);
}
