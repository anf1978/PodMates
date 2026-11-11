import type { CommanderTierRecord, EngineContext } from "./context.ts";
import type { ArchetypeMatch } from "./types.ts";
// ---- Commander Track Record (Playgroup.gg empirical win-rate data) ----
// Refreshed automatically every week via
// .github/workflows/rebuild-winrate-database.yml, which scans Playgroup.gg's
// public per-commander API (no bulk endpoint exists, so this is a full
// ID-range scan, rate-limited and identified per their stated terms) and
// keeps only commanders with 250+ tracked games and 10+ decks. This is
// EMPIRICAL data about how a commander has actually performed, distinct from
// every other score in this app (all of which are heuristics about what a
// decklist enables on paper). The records arrive as EngineContext.winRates.

// Returns an array of tier records for the deck's commander(s) — usually one,
// two for a partner pair, empty if none of them have enough tracked games to
// appear in the dataset (true for the large majority of legal commanders).
export function lookupCommanderTiers(
  ctx: EngineContext,
  commanderNames: readonly string[] | null | undefined,
): CommanderTierRecord[] {
  const idx = ctx.commanderTierIndex();
  const results: CommanderTierRecord[] = [];
  for (const name of commanderNames || []) {
    const rec = idx.get(name);
    if (rec) results.push(rec);
  }
  return results;
}

// Rough expected Spark band per empirical tier, used only to flag a notable
// Expected Spark range per empirical win-rate tier. These bounds are reasoned
// (monotonically increasing floor and ceiling as tier improves) rather than
// derived from a large-scale correlation study — there isn't yet a dataset
// tying Command Spark to real win rates at that scale. Treat this as an
// informed cross-check, not a validated statistical claim.
export const TIER_EXPECTED_SPARK: Readonly<Record<string, readonly [number, number]>> = {
  S: [5.5, 10],
  A: [4.5, 9.5],
  B: [2.5, 7.5],
  C: [1.5, 6],
  D: [1, 5],
};

// --- Archetype-conditioned refinement of the tier band ---------------------
// TIER_EXPECTED_SPARK above is deliberately wide because it's calibrated
// against the *whole* Commander ecosystem behind that win-rate data --
// casual tables through near-cEDH -- not just the 174-deck Try-a-Deck
// corpus. A variance check across that corpus found archetype explains
// meaningfully more of a deck's Command Spark than commander tier does on
// its own (~13% vs ~2% of variance, measured via R² across the corpus).
// A naive per-(tier, archetype) lookup table was tested and rejected: over
// a third of the populated cells had 1-2 decks in them, which inflates
// apparent explanatory power (R² spikes toward 100% as group count
// approaches sample count) without being a real, trustworthy band.
//
// So this applies the archetype signal as a bounded NUDGE on the existing
// tier band's center, rather than replacing it: ARCHETYPE_SPARK_OFFSET is
// each archetype's mean Command Spark minus the corpus-wide mean (computed
// once, offline, across the original 159 precon and curated decks, regenerated Oct 12, 2026 with the default impact cards and the Spellbook snapshot combos), and getExpectedSparkBand() shifts
// both ends of the tier band by that offset, damped by SPARK_OFFSET_DAMPING
// to stay conservative about extrapolating a precon-weighted corpus onto
// the broader ecosystem the tier band represents. The band's WIDTH never
// changes -- only its center -- which keeps this additive rather than
// something that could make the band untrustworthily narrow.
export const ARCHETYPE_SPARK_OFFSET: Readonly<Record<string, number>> = {
  Voltron: -0.06,
  Aristocrats: 0.14,
  "Tokens & Go-Wide": 0.16,
  "Stax & Control": 0.96,
  Spellslinger: 0.36,
  "Ramp & Big Creatures": 0.18,
  "Reanimator & Graveyard": -0.17,
  "Goodstuff & Multicolor Value": 0.05,
  "Group Hug & Politics": 0.08,
  "Blink & ETB Value": -0.3,
  "Artifacts Matter": -0.2,
  "Tribal & Typal": -0.2,
  "Enchantments Matter": -0.36,
  "Land Matters & Landfall": -0.15,
  "Mill & Self-Mill": -0.4,
};

export const SPARK_OFFSET_DAMPING = 0.75;

export function getExpectedSparkBand(
  tier: string,
  archetypeMatch: ArchetypeMatch | null | undefined,
): [number, number] {
  const [lo, hi] = TIER_EXPECTED_SPARK[tier] as readonly [number, number];
  const archetype = archetypeMatch && archetypeMatch.top ? archetypeMatch.top.deck.archetype : null;
  const offset =
    archetype && ARCHETYPE_SPARK_OFFSET[archetype] !== undefined
      ? (ARCHETYPE_SPARK_OFFSET[archetype] as number) * SPARK_OFFSET_DAMPING
      : 0;
  return [lo + offset, hi + offset];
}

export interface SparkDiscrepancy {
  direction: "underbuilt" | "overbuilt" | "matched";
  tierRecord: CommanderTierRecord;
  detail: string;
}

export function detectCommanderSparkDiscrepancy(
  tierRecords: readonly CommanderTierRecord[] | null | undefined,
  commandSpark: number,
  archetypeMatch: ArchetypeMatch | null | undefined,
): SparkDiscrepancy | null {
  if (!tierRecords || tierRecords.length === 0) return null;
  // Use the strongest tier among partner commanders as the reference point
  const order: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
  const best = [...tierRecords].sort(
    (a, b) => (order[a.t] as number) - (order[b.t] as number),
  )[0] as CommanderTierRecord;
  const [lo, hi] = getExpectedSparkBand(best.t, archetypeMatch);
  const tierLabel = `${best.n} is ${best.t}-tier (${best.w.toFixed(1)}% win rate across ${best.g.toLocaleString()} tracked games)`;

  // S/A: only flag underbuilt — a strong commander scoring high isn't a
  // surprise worth surfacing, only scoring surprisingly low is.
  if ((best.t === "S" || best.t === "A") && commandSpark < lo) {
    return {
      direction: "underbuilt",
      tierRecord: best,
      detail: `${tierLabel}, but this particular 99 scores lower than that track record would suggest. That's not necessarily a problem — could mean there's real headroom to upgrade, or that this build leans casual on purpose.`,
    };
  }
  // C/D: only flag overbuilt — a weak commander scoring low isn't a
  // surprise, only scoring surprisingly high is.
  if ((best.t === "C" || best.t === "D") && commandSpark > hi) {
    return {
      direction: "overbuilt",
      tierRecord: best,
      detail: `${best.n} has empirically underperformed as a ${best.t}-tier commander (${best.w.toFixed(1)}% win rate across ${best.g.toLocaleString()} tracked games), but this particular 99 scores higher than that track record would suggest. Could mean this build is bucking the trend, or that the commander is just a harder engine to pilot than the raw card power implies.`,
    };
  }
  // B (average tier): no directional prior either way, so both surprises
  // are worth flagging.
  if (best.t === "B" && commandSpark < lo) {
    return {
      direction: "underbuilt",
      tierRecord: best,
      detail: `${tierLabel}, but this particular 99 scores notably lower than an average-performing commander's builds typically land. Could just be an intentionally casual build.`,
    };
  }
  if (best.t === "B" && commandSpark > hi) {
    return {
      direction: "overbuilt",
      tierRecord: best,
      detail: `${tierLabel}, but this particular 99 scores notably higher than an average-performing commander's builds typically land. Worth double-checking this isn't more deck than your pod bargained for.`,
    };
  }
  // No surprise — the build lines up with what the commander's track record
  // would predict. Worth confirming explicitly rather than only ever
  // flagging surprises, since a "no news" result still tells you something.
  if (commandSpark >= lo && commandSpark <= hi) {
    return {
      direction: "matched",
      tierRecord: best,
      detail: `${tierLabel}, and this particular 99 scores right in the range that track record would predict.`,
    };
  }
  return null;
}
