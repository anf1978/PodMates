// Mana Base panel: Cost vs. Production bars per colour, plus the fixing-quality benchmark.
// The share maths lives in ../state.ts; this file only draws the result.

import { html, nothing, styleMap, trustedHtml } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { MANA_COLOR_STYLE, manaSymbol } from "../../../ui/mana-symbol.ts";
import { cardNameLinkHtml } from "../../../ui/card-name.ts";
import { explainerButton, howBuilt } from "../view.ts";
import type { ManaBaseRow } from "../state.ts";

const HOW_BUILT =
  'Cost counts every colored mana symbol in your nonland spells\' casting costs (hybrid and Phyrexian symbols count as half a pip toward each eligible color). Production counts permanent sources of each color — lands, rocks, dorks, and similar — by source count, not by output amount, matching the standard "how many sources of a color do you need" approach used in most mana-base guides. Cost and Production are shown as two separate bars per color (matching how sites like Archidekt present it) rather than folded into one verdict, so you can read the actual gap yourself. A color where Cost clearly outpaces Production gets a specific point-gap called out — not necessarily broken, but worth a look.';

/** The fixing-quality figures the app computes alongside the tallies. */
export interface ManaBaseBenchmark {
  baseline?: { medianFixingRatio: number; medianNonbasicCount: number } | null;
  avgFixingRatio: number;
  bucketLabel: string;
  bucketSampleSize: number;
  nonbasicCount: number;
  numColors: number;
  identity: string;
}

export interface ManaBaseInput {
  rows: ManaBaseRow[];
  /** Colourless sources that are not compared above, and the cards making them. */
  colorlessSources: number;
  colorlessNames: string[];
  ritualNames: string[];
  benchmark?: ManaBaseBenchmark | null;
}

/**
 * "a, b, c" with each name clickable, as one raw run so the browser lays the
 * sentence out exactly as the legacy string template did.
 */
function cardNameList(names: string[]) {
  // Trusted: every name is escaped by cardNameLinkHtml; the separator is constant.
  return trustedHtml(names.map(cardNameLinkHtml).join(", "));
}

function rowTemplate(row: ManaBaseRow): TemplateResult {
  const style = MANA_COLOR_STYLE[row.color];
  return html`<div class="dc-mb-row">
    <div class="dc-mb-head">
      <div class="dc-mb-name">
        ${manaSymbol(row.color, 22)}<strong class="dc-mb-color">${style.name}</strong>
      </div>
      ${
        row.shortfall
          ? html`<span class="dc-mb-gap">Cost outpaces production by ${row.gapPoints} pts</span>`
          : nothing
      }
    </div>
    <div class="dc-mb-bars dc-mb-bars-cost">
      <span class="dc-mb-label">Cost</span>
      <div class="dc-mb-track">
        <div
          class="dc-mb-fill"
          style=${styleMap({ width: `${row.costBarPercent.toFixed(1)}%`, background: style.bg })}
        ></div>
      </div>
      <span class="dc-mb-value"
        >${row.pips.toFixed(1)} pips (${(row.costShare * 100).toFixed(0)}%)</span
      >
    </div>
    <div class="dc-mb-bars">
      <span class="dc-mb-label">Production</span>
      <div class="dc-mb-track">
        <div
          class="dc-mb-fill dc-mb-fill-production"
          style=${styleMap({
            width: `${row.productionBarPercent.toFixed(1)}%`,
            background: style.bg,
          })}
        ></div>
      </div>
      <span class="dc-mb-value"
        >${row.sources} sources (${(row.productionShare * 100).toFixed(0)}%)</span
      >
    </div>
  </div>`;
}

function benchmarkTemplate(benchmark: ManaBaseBenchmark): TemplateResult | typeof nothing {
  const baseline = benchmark.baseline;
  if (!baseline) return nothing;
  const pct = Math.round(benchmark.avgFixingRatio * 100);
  const basePct = Math.round(baseline.medianFixingRatio * 100);
  const diff = pct - basePct;
  const diffLabel =
    diff === 0
      ? "right at the baseline"
      : diff > 0
        ? `${diff} pts above baseline`
        : `${Math.abs(diff)} pts below baseline`;
  const diffColor =
    diff <= -15 ? "var(--danger)" : diff >= 15 ? "var(--success-text)" : "var(--text-soft)";
  const medianLabel = `${benchmark.bucketLabel} median (n=${benchmark.bucketSampleSize})`;
  const note =
    `${benchmark.nonbasicCount} nonbasic land${benchmark.nonbasicCount === 1 ? "" : "s"} ` +
    `in a ${benchmark.numColors}-color (${benchmark.identity}) deck, vs. a median of ` +
    `${baseline.medianNonbasicCount} nonbasics across ${benchmark.bucketSampleSize} real ` +
    `${benchmark.bucketLabel} precons in this app's corpus.`;

  return html`<div class="dc-mb-benchmark">
    <div class="dc-mb-benchmark-title">Fixing Quality ${explainerButton("manaBaseBenchmark")}</div>
    <div class="dc-mb-benchmark-stats">
      <div class="stat">
        <span class="num">${`${pct}%`}</span><span class="lbl">This deck's fixing ratio</span>
      </div>
      <div class="stat">
        <span class="num">${`${basePct}%`}</span><span class="lbl">${medianLabel}</span>
      </div>
      <div class="stat">
        <span class="num" style=${styleMap({ color: diffColor })}>${diffLabel}</span>
      </div>
    </div>
    <div class="dc-mb-benchmark-note">${note}</div>
  </div>`;
}

export function manaBaseTemplate(input: ManaBaseInput): TemplateResult {
  const { rows, colorlessSources, colorlessNames, ritualNames, benchmark } = input;
  const colorlessNote =
    `Also produces colorless (not compared above): ${colorlessSources} ` +
    `source${colorlessSources === 1 ? "" : "s"}` +
    (colorlessNames.length
      ? ` — ${colorlessNames.slice(0, 8).map(cardNameLinkHtml).join(", ")}` +
        (colorlessNames.length > 8 ? `, +${colorlessNames.length - 8} more` : "")
      : "");
  return html`${rows.map(rowTemplate)}
  ${
    colorlessSources > 0
      ? // Trusted: constant prose, engine numeric counts, and escaped cardNameLinkHtml markup.
        html`<div class="dc-mb-note">${trustedHtml(colorlessNote)}</div>`
      : nothing
  }
  ${
    ritualNames.length
      ? html`<div class="dc-mb-note">
          Not counted toward Production (one-time, not a sustained source):
          ${cardNameList(ritualNames)}
        </div>`
      : nothing
  }
  ${benchmark ? benchmarkTemplate(benchmark) : nothing}
  ${howBuilt("How was this built?", HOW_BUILT)}`;
}
