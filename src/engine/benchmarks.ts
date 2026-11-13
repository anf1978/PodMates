// Benchmarks against the real precon corpus: the closest precon by synergy fingerprint, staples
// counts against the matched archetype's median, and mana-base fixing against decks of the same
// colours. The corpus data (PRECON_FINGERPRINTS, TRY_A_DECK_METADATA, STAPLES_BASELINE and
// MANABASE_BASELINE datasets) comes in as arguments.

import type { CardRecord } from "../cards/tuple.ts";
import type { DeckEntry } from "./types.ts";

// Archetype fingerprinting: a 27-dimension synergy/tag vector per precon
// (15 detected-theme densities + 10 mechanical-signal densities + Voltron's
// aura/equipment density), computed by the same engine that scores the
// user's own deck. At runtime we build the identical vector for whatever
// deck was just analyzed and rank it by cosine similarity against this
// corpus, surfacing the closest real precon as a "closest match" callout
// instead of a synthetic archetype label with no grounding.
export const FINGERPRINT_KEYS = {
  themes: [
    "aristocrats",
    "tokens",
    "artifacts",
    "spellslinger",
    "graveyard",
    "drain",
    "lifegain",
    "landfall",
    "counters",
    "blink",
    "stax",
    "landBuffing",
    "minusCounters",
    "impulseDraw",
    "exileMatters",
  ],
  mech: [
    "ramp",
    "tutor",
    "removal",
    "wipe",
    "draw",
    "reanimate",
    "sac",
    "counterMagic",
    "discard",
    "extraTurn",
  ],
} as const;

/** [deckKey, vector] pairs, in no particular order; looked up by key against the metadata. */
export type PreconFingerprint = readonly [key: string, vector: readonly number[]];

export interface SampleDeckMeta {
  key: string;
  archetype: string;
}

/** The deck counts the fingerprint and staples checks read. */
export type BenchmarkAgg = {
  readonly nonlandCount?: number;
  readonly themes: Readonly<Record<string, number | undefined>>;
  readonly auraCount?: number;
  readonly equipmentCount?: number;
};

function count(agg: object, key: string): number {
  return ((agg as Record<string, unknown>)[key] as number | undefined) || 0;
}

export function buildFingerprintVector(agg: BenchmarkAgg): number[] {
  const nl = Math.max(agg.nonlandCount || 1, 1);
  const themeVec = FINGERPRINT_KEYS.themes.map((k) => (agg.themes[k] || 0) / nl);
  const mechVec = FINGERPRINT_KEYS.mech.map((k) => count(agg, k) / nl);
  const auraEquipVec = [(agg.auraCount || 0) / nl, (agg.equipmentCount || 0) / nl];
  return [...themeVec, ...mechVec, ...auraEquipVec];
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as number,
      y = b[i] as number;
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export interface ArchetypeCandidate<M> {
  key: string;
  sim: number;
  deck: M;
}

export interface ArchetypeMatch<M> {
  top: ArchetypeCandidate<M>;
  runnersUp: ArchetypeCandidate<M>[];
}

/** Ranks the analyzed deck against every precon fingerprint and returns the
 * top match plus up to two runners-up from a genuinely different precon
 * (skips near-duplicate scores from the same style/commander family so the
 * "also similar to" list doesn't just repeat five reskins of one deck). */
export function computeArchetypeMatch<M extends SampleDeckMeta>(
  fingerprints: readonly PreconFingerprint[],
  metadata: readonly M[],
  agg: BenchmarkAgg,
): ArchetypeMatch<M> | null {
  const vector = buildFingerprintVector(agg);
  const magnitude = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  if (magnitude < 0.05) return null; // too thin a signal to claim a match

  const ranked = fingerprints
    .map(([key, vec]) => ({ key, sim: cosineSimilarity(vector, vec) }))
    .sort((a, b) => b.sim - a.sim);

  const withMeta = ranked
    .map((r) => {
      const deck = metadata.find((o) => o.key === r.key);
      return deck ? { ...r, deck } : null;
    })
    .filter((r): r is ArchetypeCandidate<M> => Boolean(r));

  const top = withMeta[0];
  if (!top) return null;
  // Runners-up should surface genuinely different alternate readings of the
  // deck, not just other precons that happen to share the top match's own
  // archetype (which would just repeat the same story twice).
  const runnersUp: ArchetypeCandidate<M>[] = [];
  for (const r of withMeta.slice(1)) {
    if (runnersUp.length >= 2) break;
    if (r.deck.archetype === top.deck.archetype) continue;
    if (runnersUp.some((x) => x.deck.archetype === r.deck.archetype)) continue;
    runnersUp.push(r);
  }
  return { top, runnersUp };
}

// Staples baseline: median raw counts of 12 key mechanical categories
// (sac outlets, ramp, tutors, removal, wipes, draw, counterspells,
// reanimation, discard, extra turns, stax, protection), computed per
// archetype across the real precon corpus. Paired at runtime with whatever
// archetype computeArchetypeMatch() lands on, so "this deck runs 3 sac
// outlets" can be measured against "the Aristocrats baseline is 7" rather
// than an arbitrary number with no reference point.
export interface StaplesBaseline {
  keys: readonly string[];
  baselines: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export const STAPLE_LABELS: Readonly<Record<string, string>> = {
  sacOutlets: "Sacrifice outlets",
  ramp: "Ramp",
  tutor: "Tutors",
  removal: "Removal",
  wipe: "Board wipes",
  draw: "Card draw",
  counterMagic: "Counterspells",
  reanimate: "Reanimation",
  discard: "Discard",
  extraTurn: "Extra turns",
  stax: "Stax pieces",
  protection: "Protection",
};

export interface StaplesDeviation {
  key: string;
  label: string;
  actual: number;
  baseline: number;
  direction: "under" | "over";
  magnitude: number;
}

export interface StaplesCheck {
  baseline: Readonly<Record<string, number>> | null;
  sampleSize?: number;
  deviations: StaplesDeviation[];
}

/** Compares this deck's raw counts against the median for the given
 * archetype, returning up to 4 of the most notably over/under-baseline
 * categories (deviation-ranked), or an empty array if the deck tracks the
 * baseline closely across the board. Baselines under 2 are skipped entirely
 * to avoid flagging noise around near-universal zeros (e.g. tutors). */
export function computeStaplesDeviation(
  staples: StaplesBaseline,
  agg: object,
  archetype: string,
): StaplesCheck {
  const baseline = staples.baselines[archetype];
  if (!baseline) return { baseline: null, deviations: [] };
  const deviations: StaplesDeviation[] = [];
  for (const key of staples.keys) {
    const base = baseline[key] as number;
    if (base < 2) continue;
    const actual = count(agg, key);
    const ratio = actual / base;
    if (ratio <= 0.5 || ratio >= 1.75) {
      deviations.push({
        key,
        label: STAPLE_LABELS[key] as string,
        actual,
        baseline: base,
        direction: ratio < 1 ? "under" : "over",
        magnitude: Math.abs(Math.log2(Math.max(ratio, 0.01))),
      });
    }
  }
  deviations.sort((a, b) => b.magnitude - a.magnitude);
  return { baseline, sampleSize: baseline.n, deviations: deviations.slice(0, 4) };
}

// Mana-base benchmarking: for each of the 177 colored precon and curated decks (the one
// colorless commander in the corpus is excluded -- fixing quality isn't a
// meaningful question for it), a "fixing ratio" per nonbasic land -- the
// average fraction of the deck's own color identity each nonbasic land can
// actually produce (a perfect-fit dual in a 2-color deck scores 1.0; a
// same land in a 3-color deck scores 0.67) -- plus median nonbasic land
// count, bucketed both by exact color identity (e.g. "WUB") and by raw
// color count (1-5) as a fallback when a specific combination is too rare
// in the corpus to benchmark against directly.
export type ManaBaseBucket = Readonly<Record<string, number>> & {
  readonly n: number;
  readonly medianFixingRatio: number;
  readonly medianNonbasicCount: number;
};

export interface ManaBaseBaseline {
  byIdentity: Readonly<Record<string, ManaBaseBucket | undefined>>;
  byCount: Readonly<Record<string, ManaBaseBucket | undefined>>;
}

export interface ManaBaseBenchmark {
  identity: string;
  numColors: number;
  nonbasicCount: number;
  avgFixingRatio: number;
  bucketLabel: string;
  bucketSampleSize: number;
  baseline: ManaBaseBucket | null;
}

/** Computes this deck's own fixing ratio the identical way the benchmark
 * corpus was scored, then looks up the best-available baseline bucket --
 * exact color identity if the corpus has 4+ decks in it, otherwise the
 * broader same-color-count bucket. matchedCards is the raw {qty, card}
 * list from matchDecklist (not agg), since per-land fixing detail isn't
 * retained on the aggregate object. */
export function computeManaBaseBenchmark(
  manabase: ManaBaseBaseline,
  matchedCards: readonly DeckEntry[],
  commanderCards: readonly CardRecord[],
): ManaBaseBenchmark | null {
  const WUBRG = ["W", "U", "B", "R", "G"];
  const identitySet = new Set<string>();
  for (const c of commanderCards) for (const ch of c.ci || "") identitySet.add(ch);
  if (!identitySet.size) return null;
  const identity = WUBRG.filter((c) => identitySet.has(c)).join("");

  let nonbasicCount = 0;
  let fixingRatioSum = 0;
  for (const { qty, card } of matchedCards) {
    const typeLine = (card.t || "").toLowerCase();
    if (!typeLine.includes("land")) continue;
    if (typeLine.startsWith("basic land")) continue;
    nonbasicCount += qty;
    const producible = (card.pm || "").split("").filter((ch) => identitySet.has(ch)); // colours the land actually makes (color identity is empty for Command Tower and friends)
    const ratio = producible.length / identitySet.size;
    fixingRatioSum += ratio * qty;
  }
  const avgFixingRatio = nonbasicCount ? fixingRatioSum / nonbasicCount : 0;

  const exactBucket = manabase.byIdentity[identity];
  const countBucket = manabase.byCount[String(identitySet.size)];
  const useExact = exactBucket && exactBucket.n >= 4;
  const bucket = useExact ? exactBucket : countBucket;

  return {
    identity,
    numColors: identitySet.size,
    nonbasicCount,
    avgFixingRatio: Math.round(avgFixingRatio * 1000) / 1000,
    bucketLabel: useExact ? identity : `${identitySet.size}-color decks`,
    bucketSampleSize: bucket ? bucket.n : 0,
    baseline: bucket || null,
  };
}
