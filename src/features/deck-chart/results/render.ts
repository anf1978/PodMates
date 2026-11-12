// Paints the result panels into their page elements. Each paint starts from an empty area, as
// the old innerHTML writes did, so nothing (open <details>, old badges) carries over.

import type { BracketResult } from "../../../engine/brackets.ts";
import type { SparkDiscrepancy } from "../../../engine/commander-tiers.ts";
import type { SpiritBand } from "../../../engine/spark.ts";
import type { TableFeel } from "../../../engine/table-feel.ts";
import type { WinCondition } from "../../../engine/types.ts";
import type { ArchetypeMatch } from "../../../engine/benchmarks.ts";
import { emit } from "../../../services/events.ts";
import { currentChart, updateChart, type AxisScores } from "../../../services/current-chart.ts";
import type { CurrentChart } from "../../../services/current-chart.ts";
import {
  axisPercentile,
  referenceSummary,
  sparkPercentile,
  type SampleDeck,
} from "../../../services/reference-data.ts";
import { nothing, render } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { archetypeMatchTemplate, tableFeelTemplate, winConditionTemplate } from "./callouts.ts";
import { bracketTemplate, type BracketAgg } from "./bracket.ts";
import { notFoundTemplate, type FuzzyMatch } from "./notices.ts";
import { radarTemplate } from "./radar.ts";

function paint(id: string, template: TemplateResult): void {
  const area = document.getElementById(id);
  if (!area) return;
  render(nothing, area);
  render(template, area);
}

export function renderWinCondition(winCons: readonly WinCondition[]): void {
  paint("winConCallout", winConditionTemplate(winCons));
}

export function renderArchetypeMatch(match: ArchetypeMatch<SampleDeck> | null): void {
  paint("archetypeMatchCallout", archetypeMatchTemplate(match));
}

export function renderTableFeel(tableFeel: TableFeel, deckCraft: SpiritBand | null): void {
  paint("tableFeelCallout", tableFeelTemplate(tableFeel, deckCraft));
}

type ChartAgg = NonNullable<CurrentChart["agg"]>;

export function renderChart(
  scores: AxisScores,
  commandSpark: number,
  agg: ChartAgg | null,
  tierDiscrepancy: SparkDiscrepancy | null,
): void {
  updateChart({ agg: agg || null, scores: scores || null, commandSpark });
  const area = document.getElementById("chartArea");
  // The radar's text is sized from the width the chart really gets.
  const boxWidth = Math.min(560, area?.clientWidth || Math.min(window.innerWidth - 40, 560));
  const textZoom = parseFloat(document.documentElement.getAttribute("data-pm-text") || "1") || 1; // set by src/features/themes/apply.ts
  updateChart({ tierDiscrepancy: tierDiscrepancy || null });
  paint(
    "chartArea",
    radarTemplate({
      scores,
      commandSpark,
      tierDiscrepancy,
      withImpact: Boolean(agg),
      boxWidth,
      textZoom,
      axisPercentile,
      sparkPercentile,
      referenceSummary,
    }),
  );
  if (agg) emit("chart:radar", agg);
}

/** Re-draws the radial when the text size changes or the phone turns, so its labels are re-fitted. */
export function bindChartRedraw(): void {
  let lastW = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const redo = () => {
    const { scores, agg, commandSpark, tierDiscrepancy } = currentChart();
    try {
      if (scores && agg) renderChart(scores, commandSpark as number, agg, tierDiscrepancy);
    } catch {
      /* the chart stays as it was */
    }
  };
  window.addEventListener("pm-text-change", () => setTimeout(redo, 50));
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = document.getElementById("chartArea")?.clientWidth || 0;
      if (Math.abs(w - lastW) > 20) {
        lastW = w;
        redo();
      }
    }, 250);
  });
}

export function renderBracket(bracket: BracketResult, agg: (BracketAgg & object) | null): void {
  updateChart({
    bracketKey: bracket && bracket.bracketKey,
    gameChangersHeld: agg && agg.gameChangers ? agg.gameChangers.length : 0,
  });
  paint("bracketArea", bracketTemplate(bracket, agg));
}

/** Under the form. Rendered through a fragment so the inline Clear button may still empty the box. */
export function renderNotFound(notFound: readonly string[], fuzzyMatches: readonly FuzzyMatch[]) {
  const box = document.getElementById("notFoundBox");
  if (!box) return;
  const fragment = document.createDocumentFragment();
  render(notFoundTemplate(notFound, fuzzyMatches), fragment);
  box.replaceChildren(fragment);
}
