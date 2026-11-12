// The radar ("radial") chart area: the SVG from src/ui/radar-chart.ts, the scores as plain text
// (that list grows with the Text size setting), Spark, the commander track-record badge, the
// reference-set caption and the mount point for the Impact caption.

import type { SparkDiscrepancy } from "../../../engine/commander-tiers.ts";
import type { AxisScores } from "../../../services/current-chart.ts";
import { ordinal } from "../../../ui/format.ts";
import { html, nothing, trustedHtml } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { radarChartSvg } from "../../../ui/radar-chart.ts";
// The button without its own leading space, so the label before it stays one text node.
import { explainerButton } from "../view.ts";

export const AXES = [
  { key: "speed", label: "Speed", short: "Speed" },
  { key: "consistency", label: "Consistency", short: "Consist." },
  { key: "versatility", label: "Versatility", short: "Versatility" },
  { key: "disruption", label: "Disruption", short: "Disrupt." },
  { key: "powerLevel", label: "Power Level", short: "Power" },
] as const;

export interface RadarInput {
  scores: AxisScores;
  commandSpark: number;
  tierDiscrepancy: SparkDiscrepancy | null;
  /** Whether to leave room for the Impact caption (only when a deck analysis exists). */
  withImpact: boolean;
  boxWidth: number;
  textZoom: number;
  axisPercentile(key: string, value: number): number | null;
  sparkPercentile(value: number): number;
  referenceSummary(): string;
}

const DISCREPANCY_LABELS: Record<SparkDiscrepancy["direction"], string> = {
  underbuilt: "Underbuilt for this commander",
  overbuilt: "Overbuilt for this commander",
  matched: "Matches this commander's track record",
};

export function radarTemplate(input: RadarInput): TemplateResult {
  const { scores, commandSpark, tierDiscrepancy } = input;
  const svg = radarChartSvg({
    axes: AXES,
    scores,
    percentile: input.axisPercentile,
    boxWidth: input.boxWidth,
    textZoom: input.textZoom,
  });
  const scoreRows = AXES.map((a) => {
    const v = scores[a.key];
    const pc = input.axisPercentile(a.key, v);
    // prettier-ignore
    return html`<span>${a.label}</span><strong class="rs-gold">${v.toFixed(1)}</strong><span class="rs-soft">${pc !== null ? ordinal(pc) + " pct." : ""}</span>`;
  });
  const sparkPct = input.sparkPercentile(commandSpark);
  const badge = tierDiscrepancy
    ? // prettier-ignore
      html`<div class="rs-disc"><span class=${`rs-disc-badge rs-disc-${tierDiscrepancy.direction}`} title=${tierDiscrepancy.detail}>${DISCREPANCY_LABELS[tierDiscrepancy.direction]}</span></div>`
    : nothing;
  // prettier-ignore
  return html`${
    // Trusted: radarChartSvg builds the SVG from the constant axis labels and numeric scores.
    trustedHtml(svg)
  }<div class="chart-scores" aria-label="Scores as text">${scoreRows}</div><div class="command-spark" data-explain="commandSpark" title="What is Spark?"><div class="spark-main"><span class="lbl">Spark</span><span class="num">${commandSpark.toFixed(1)}</span> ${explainerButton("commandSpark")}</div><span class="spark-percentile">${`Table-alignment signal · ${ordinal(sparkPct)} percentile of the PodMates reference set`}</span></div>${badge}<div class="chart-caption">${`Percentiles compare against the PodMates reference set (${input.referenceSummary()}), not all Commander decks. Higher tiers are included so tuned and competitive decks are not all squeezed into the top few percent.`}</div>${input.withImpact ? html`<div id="impactChart"></div>` : nothing}`;
}
