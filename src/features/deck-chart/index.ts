// Deck Chart's entry: binds the Chart Deck button, the explainer and "Cards you could add"
// clicks and the radar redraw, and charts a deck on request. The page supplies its card data
// and deck form through ports until those move out of index.html.

import type { CardRecord } from "../../cards/tuple.ts";
import { comboCardByName } from "../../engine/combos.ts";
import { pageContext } from "../../engine/legacy-globals.ts";
import { fetchCardImagesBatch } from "../../services/card-art.ts";
import { currentChart } from "../../services/current-chart.ts";
import {
  axisPercentile,
  referenceSummary,
  sparkPercentile,
  staplesDeviation,
  tierPlacement,
} from "../../services/reference-data.ts";
import { bindExplainerClicks, type ExplainerPorts } from "./explainers/index.ts";
import { buildInteractionPackages, showSuggestions } from "./interactions/index.ts";
import type {
  InteractionData,
  InteractionTags,
  KnowCard,
  KnowledgeJson,
} from "./interactions/index.ts";
import { lastCentrality } from "./report.ts";
import { AXES } from "./results/radar.ts";
import { bindChartRedraw } from "./results/render.ts";
import { runAnalysis, type ChartPorts, type ReportPorts } from "./run-analysis.ts";

export interface DeckChartPorts extends ChartPorts {
  cards(): CardRecord[];
  tags(): InteractionTags;
  loadKnowledge(): Promise<void>;
  knowledge(): { json: KnowledgeJson; byName: Map<string, KnowCard> };
}

function goToKeyPieces(): void {
  const panel = document.getElementById("keyPiecesPanel");
  if (!panel) return;
  const d = panel.querySelector("details");
  if (d) d.open = true;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

const explainerPorts: ExplainerPorts = {
  agg: () => currentChart().agg,
  winCons: () => currentChart().winCons,
  scores: () => currentChart().scores,
  commandSpark: () => currentChart().commandSpark,
  centrality: lastCentrality,
  axes: () => AXES,
  sparkPercentile,
  axisPercentile,
  tierPlacement: (value, key) =>
    key === undefined ? tierPlacement(value) : tierPlacement(value, key),
  referenceSummary,
};

/** Wires Deck Chart to the page and returns the chart request for the remaining inline callers. */
export function mount(page: DeckChartPorts): { runAnalysis(): Promise<void> } {
  const data = (): InteractionData => ({ cards: page.cards(), tags: page.tags() });
  const panels: ReportPorts = {
    keyPieces: {
      comboCard: (name) => comboCardByName(pageContext(), name) ?? null,
      // The decoded snapshot carries its build date beside the typed fields.
      spellbookDate: () => (pageContext().spellbook?.snap as { date?: string } | undefined)?.date,
      fetchImages: (names) => fetchCardImagesBatch(names),
    },
    synergy: {
      packages: (matched, commanders) => buildInteractionPackages(data(), matched, commanders),
      staples: (agg, archetype) => staplesDeviation(agg, archetype),
    },
  };
  const suggestionPorts = {
    data,
    loadKnowledge: () => page.loadKnowledge(),
    knowledge: () => page.knowledge(),
    bracket: () => ({ key: currentChart().bracketKey, held: currentChart().gameChangersHeld }),
  };
  const chart = () => runAnalysis(page, panels);

  bindExplainerClicks(explainerPorts, goToKeyPieces);
  // The Synergy panel's "Cards you could add ›" button.
  document.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (target?.closest?.("[data-show-ix-suggestions]")) void showSuggestions(suggestionPorts);
  });
  const chartBtn = document.getElementById("chartBtn");
  chartBtn?.addEventListener("click", () => {
    chartBtn.classList.remove("tad-pulsing");
    void chart();
  });
  bindChartRedraw();
  return { runAnalysis: chart };
}
