// The reference corpus the chart compares against: axis scores and tiers, staples and mana-base
// baselines (stored by card-db-boot before DB-ready), plus the precon fingerprints and Try-a-Deck
// metadata, which load lazily the first time a chart or comparison needs a closest match.
// The maths lives in src/engine/{reference,benchmarks}.ts; this module only holds the data.

import { loadDataset } from "../data/load-dataset";
import type { CardRecord } from "../cards/tuple";
import type { DeckEntry } from "../engine/types";
import {
  computeArchetypeMatch,
  computeAxisPercentile,
  computeManaBaseBenchmark,
  computeSparkPercentile,
  computeStaplesDeviation,
  computeTierPlacement,
  describeTierPlacement,
  referenceSetSummary,
  type ManaBaseBaseline,
  type PreconFingerprint,
  type ReferenceSet,
  type SampleDeckMeta,
  type StaplesBaseline,
} from "../engine";
import type { BenchmarkAgg } from "../engine/benchmarks";

export interface StaticReference {
  referenceScores: number[][];
  referenceTiers: string[];
  staplesBaseline: StaplesBaseline;
  manabaseBaseline: ManaBaseBaseline;
}

/** A Try-a-Deck metadata row, as the Closest Match callout reads it. */
export interface SampleDeck extends SampleDeckMeta {
  flavorName: string;
  commander: string;
  source?: string;
  setName?: string;
}

let corpus: { set: ReferenceSet; staples: StaplesBaseline; manabase: ManaBaseBaseline } | null =
  null;
let fingerprints: readonly PreconFingerprint[] | null = null;
let sampleDecks: readonly SampleDeck[] = [];
let analysisReady: Promise<void> | undefined;

export function setStaticReference(data: StaticReference): void {
  corpus = {
    set: { scores: data.referenceScores, tiers: data.referenceTiers },
    staples: data.staplesBaseline,
    manabase: data.manabaseBaseline,
  };
}

function loaded(): NonNullable<typeof corpus> {
  if (!corpus) throw new Error("Reference data is not loaded yet.");
  return corpus;
}

/** True once the precon fingerprints have loaded. */
export function analysisDatasetsLoaded(): boolean {
  return fingerprints !== null;
}

/**
 * Loads the precon fingerprints and Try-a-Deck metadata once. `available` drops the sample decks
 * whose cards are not in this card database yet, as the deck library does.
 */
export function loadAnalysisDatasets(
  available: (decks: SampleDeck[]) => SampleDeck[],
): Promise<void> {
  return (analysisReady ||= (async () => {
    const [prints, metadata] = await Promise.all([
      loadDataset<PreconFingerprint[]>("PRECON_FINGERPRINTS"),
      loadDataset<SampleDeck[]>("TRY_A_DECK_METADATA"),
    ]);
    fingerprints = prints;
    sampleDecks = available(metadata);
  })());
}

export function axisPercentile(axisKey: string, value: number): number | null {
  return computeAxisPercentile(loaded().set, axisKey, value);
}

export function sparkPercentile(value: number): number {
  return computeSparkPercentile(value);
}

export function tierPlacement(value: number, axisKey?: string): string {
  return describeTierPlacement(loaded().set, value, axisKey);
}

/** Command Spark's placement within each reference tier (precon, tuned, cEDH). */
export function tierPlacements(value: number) {
  return computeTierPlacement(loaded().set, value);
}

export function referenceSummary(): string {
  return referenceSetSummary(loaded().set);
}

export function archetypeMatch(agg: BenchmarkAgg) {
  if (!fingerprints) throw new Error("Analysis data is not loaded yet.");
  return computeArchetypeMatch(fingerprints, sampleDecks, agg);
}

export function staplesDeviation(agg: object, archetype: string) {
  return computeStaplesDeviation(loaded().staples, agg, archetype);
}

export function manaBaseBenchmark(
  matched: readonly DeckEntry[],
  commanderCards: readonly CardRecord[],
) {
  return computeManaBaseBenchmark(loaded().manabase, matched, commanderCards);
}
