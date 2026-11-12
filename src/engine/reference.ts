// Percentiles and tier placement against the PodMates reference set: real axis scores for 224
// decks across three tiers, computed by running this same engine (analyzeDeck + the five axes)
// against each list:
//   p = 168 official precons (Try-a-Deck entries)
//   t =  36 tuned decks: 6 hand-curated Try-a-Deck entries plus 30 EDHREC
//           Bracket 4 ("optimized") average decks covering all 15 archetypes
//   c =  20 cEDH tournament lists from the 20 most competitive commanders
// Regenerated Oct 12, 2026 with the default impact cards in Power and the Commander Spellbook
// snapshot combos counted (the combo snapshot is part of the standard engine). 15 precons were
// added Nov 1, 2026 (Fallout x4, Commander Legends: Battle for Baldur's Gate x4, Foundations
// Commander x5, Multiverse Reforged, Odds and Ends) with the same engine; the other fitted
// constants (centrality bands, spark band) were not re-fitted. Rows 0-173 are the 6 curated and
// 168 precon decks (rows 159-173 are the 15 additions), rows 174-203 the tuned EDHREC decks and
// 204-223 the cEDH lists. The scores and tiers are the REFERENCE_SCORES / REFERENCE_TIERS
// datasets (row-parallel); Spark is the curated REFERENCE_SPARK table. Used to give each axis
// score a percentile and a tier placement against real decks rather than a bare 1-10 number.

import { REFERENCE_SPARK } from "../data/reference-spark.ts";

export interface ReferenceSet {
  /** One row per deck: [speed, consistency, versatility, disruption, powerLevel]. */
  readonly scores: readonly (readonly number[])[];
  /** Tier letter per row: "p", "t" or "c". */
  readonly tiers: readonly string[];
}

export const REFERENCE_TIER_LABELS: Readonly<Record<string, string>> = {
  p: "official precons",
  t: "tuned decks",
  c: "cEDH tournament lists",
};

export const BENCHMARK_AXIS_INDEX: Readonly<Record<string, number>> = {
  speed: 0,
  consistency: 1,
  versatility: 2,
  disruption: 3,
  powerLevel: 4,
};

export interface TierPlacement {
  tier: string;
  label: string;
  n: number;
  pctBelow: number;
}

/** Where a value sits within each reference tier: the share of that tier's decks it scores
 * above (ties count half). A missing axisKey means Command Spark. */
export function computeTierPlacement(
  ref: ReferenceSet,
  value: number,
  axisKey?: string | null,
): TierPlacement[] {
  const idx = axisKey ? BENCHMARK_AXIS_INDEX[axisKey] : null;
  const vals = axisKey ? ref.scores.map((r) => r[idx as number]) : REFERENCE_SPARK;
  return ["p", "t", "c"].map((t) => {
    const tv = vals.filter((_, i) => ref.tiers[i] === t);
    const below = tv.filter((v) => (v as number) < value).length;
    const equal = tv.filter((v) => v === value).length;
    return {
      tier: t,
      label: REFERENCE_TIER_LABELS[t] as string,
      n: tv.length,
      pctBelow: Math.round(((below + equal * 0.5) / tv.length) * 100),
    };
  });
}

/** One sentence: "higher than 98% of the 153 official precons, ...". */
export function describeTierPlacement(
  ref: ReferenceSet,
  value: number,
  axisKey?: string | null,
): string {
  return computeTierPlacement(ref, value, axisKey)
    .map((p) => `${p.pctBelow}% of the ${p.n} ${p.label}`)
    .join(", ")
    .replace(/, ([^,]*)$/, ", and $1");
}

/** Short caption naming the reference set and its three tiers. */
export function referenceSetSummary(ref: ReferenceSet): string {
  const c = computeTierPlacement(ref, 0).map((p) => `${p.n} ${p.label}`);
  return `${REFERENCE_SPARK.length} real decks scored by this same engine: ${c[0]}, ${c[1]} and ${c[2]}`;
}

export function computeSparkPercentile(value: number): number {
  const below = REFERENCE_SPARK.filter((v) => v < value).length;
  const equal = REFERENCE_SPARK.filter((v) => v === value).length;
  const percentile = Math.round(((below + equal * 0.5) / REFERENCE_SPARK.length) * 100);
  return Math.min(Math.max(percentile, 1), 99);
}

export function computeAxisPercentile(
  ref: ReferenceSet,
  axisKey: string,
  value: number,
): number | null {
  const idx = BENCHMARK_AXIS_INDEX[axisKey];
  if (idx === undefined) return null;
  const values = ref.scores.map((row) => row[idx] as number);
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  // Midpoint-of-ties convention: a value tied with others is credited with
  // half of the tied group, avoiding both the too-generous (count ties as
  // below) and too-harsh (count ties as above) extremes.
  const percentile = Math.round(((below + equal * 0.5) / values.length) * 100);
  return Math.min(Math.max(percentile, 1), 99);
}
