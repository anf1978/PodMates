import type { DeckAnalysis } from "../analyze-tallies.ts";
import { DEFAULT_IMPACT_CARDS } from "../../data/impact-defaults.ts";
import { clamp } from "./shared.ts";

export const IMPACT_PTS_PER_CARD = 0.25;

export const IMPACT_PTS_CAP = 2.0;

/** Names from impactList that are in the (non-banned) deck. */
export function impactCardsInDeck(
  agg: Pick<DeckAnalysis, "deckCardNames">,
  impactList?: readonly string[] | null,
): string[] {
  const have = new Set((agg.deckCardNames || []).map((n) => String(n).toLowerCase()));
  return (impactList || DEFAULT_IMPACT_CARDS).filter((n) => have.has(String(n).toLowerCase()));
}

export function scorePowerLevel(agg: DeckAnalysis, impactList?: readonly string[] | null): number {
  // Recalibrated so Game Changers alone can't saturate the axis: it now takes
  // ~16 GCs to hit the per-term cap, not ~5, giving real separation between a
  // deck that just cleared the Bracket 4 floor and one that's maximally tuned.
  const gcPts = Math.min(agg.gameChangers.length * 0.44, 7.0);
  const freePts = Math.min(agg.freeInteraction * 0.35, 1.5);
  // Reliability-weighted, not flat per-combo credit — see the note above
  // the combo-detection loop for the full reasoning. A bare, unsupported
  // combo (reliability ~1.0) now contributes less than the old flat 1.3;
  // a commander-anchored, tutored, protected one (reliability ~2.5+)
  // contributes more, reflecting that it's a genuinely bigger threat.
  const comboReliabilitySum = (agg.detectedComboDetails || []).reduce(
    (s, c) => s + (c.reliability || 1),
    0,
  );
  const comboPts = Math.min(comboReliabilitySum * 0.9, 3.5);
  // Raw resource scariness doesn't need the same "does this enable a plan"
  // nuance Speed applies — a huge pile of fast mana is threatening on its
  // own regardless of focus, just with extended-tier cards weighted down
  // for being more conditional than the core list.
  const fastPts = Math.min(((agg.fastMana || 0) + (agg.fastManaExtended || 0) * 0.5) * 0.25, 1.5);
  const tutorPts = Math.min((agg.tutorWeighted || agg.tutor) * 0.12, 0.8);
  // Land reanimation / mass land search (landBuffing) is a real power signal
  // — a Splendid Reclamation blowout after a wipe, or Primeval Titan into a
  // huge mana jump, is genuinely scary — but softer than a Game Changer or a
  // hard combo line, so weighted modestly.
  const landBuffPts = Math.min(
    (agg.landBuffingWeighted || agg.themes.landBuffing || 0) * 0.15,
    1.0,
  );
  // Extra-turn effects are a comparable raw-power signal to combos (can lock
  // opponents out of the game entirely), but softer without a combo to chain
  // into, so capped lower than comboPts.
  const extraTurnPts = Math.min((agg.extraTurnWeighted || agg.extraTurn || 0) * 0.3, 1.2);
  // Mana multipliers and land engines are categorically more explosive than
  // flat ramp -- a Mana Reflection compounds with everything else in the
  // deck rather than adding a fixed amount, and a Gaea's Cradle-style land
  // can produce far more than a normal land ever would. Both already get
  // generic ramp credit in Speed; this is the extra "how scary" recognition
  // that flat ramp counting misses, castability-weighted like the rest.
  const explosiveManaPts = Math.min(
    ((agg.manaMultiplierWeighted || 0) + (agg.landEngineWeighted || 0)) * 0.3,
    1.2,
  );
  // A deck can be genuinely scary through many individually-modest engine
  // pieces compounding over a long game, not just bombs/combos/fast mana --
  // reusing the same engine density signal Consistency already relies on
  // (repeating triggers/activated abilities), since a deck built this way
  // is both more likely to find its plan (Consistency's question) AND more
  // likely to overwhelm the table with accumulating value (this question).
  // Baselined at 0.35 so an ordinary deck's normal share of "whenever"/
  // "{T}:" cards doesn't earn credit -- only genuine density above that.
  const enginePts = Math.min(Math.max((agg.engineRatio || 0) - 0.35, 0) * 6.0, 1.5);
  const impactPts = Math.min(
    impactCardsInDeck(agg, impactList).length * IMPACT_PTS_PER_CARD,
    IMPACT_PTS_CAP,
  );
  const raw =
    1.0 +
    gcPts +
    freePts +
    comboPts +
    fastPts +
    tutorPts +
    landBuffPts +
    extraTurnPts +
    explosiveManaPts +
    enginePts +
    impactPts;
  return clamp(Math.round(raw * 10) / 10);
}
