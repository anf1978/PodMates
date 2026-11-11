// The deck on the Deck Chart right now. Deck Chart writes it while charting; Impact, export,
// the type galleries and the explainers read it. Readers never change it.

import type { MatchedCard } from "../cards/lookup";
import type { DeckAnalysis } from "../engine/analyze-tallies";
import type { SparkDiscrepancy } from "../engine/commander-tiers";
import type { WinCondition } from "../engine/types";

export type AxisScores = Record<
  "speed" | "consistency" | "versatility" | "disruption" | "powerLevel",
  number
>;

export interface CurrentChart {
  agg: (DeckAnalysis & { commanders: string[] }) | null;
  matched: MatchedCard[] | null;
  commanders: string[] | null;
  winCons: WinCondition[] | null;
  scores: AxisScores | null;
  commandSpark: number | null;
  tierDiscrepancy: SparkDiscrepancy | null;
  /** The detected bracket key and Game Changer count, for the "Cards you could add" note. */
  bracketKey: string | undefined;
  gameChangersHeld: number;
  /** True once a single deck has been charted (the results stay hidden until then). */
  hasResult: boolean;
}

const chart: CurrentChart = {
  agg: null,
  matched: null,
  commanders: null,
  winCons: null,
  scores: null,
  commandSpark: null,
  tierDiscrepancy: null,
  bracketKey: undefined,
  gameChangersHeld: 0,
  hasResult: false,
};

export function currentChart(): Readonly<CurrentChart> {
  return chart;
}

export function updateChart(patch: Partial<CurrentChart>): void {
  Object.assign(chart, patch);
}
