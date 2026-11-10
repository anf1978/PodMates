import type { DeckAnalysis } from "./analyze-tallies.ts";
import { computeManaCurve } from "./axes/shared.ts";
import { EARLY_COMBO_BY_TURN, comboIsEarly } from "./brackets.ts";

/** Command Spark: weighted average of the five axes. Power Level and
 * Disruption are weighted up (they most directly predict whether a deck
 * will dominate or overwhelm a table — the thing that actually matters for
 * matching decks into fair, closely-fought games), while Speed, Consistency,
 * and Versatility are weighted down (they describe a deck's own internal
 * quality — how well-oiled its plan is — which is real but less directly
 * tied to how much it steamrolls opponents). Verified against an 11-deck
 * spread spanning real D-tier precons (12-15% empirical win rate) through
 * near-cEDH lists: this reweighting widens the gap between genuinely
 * table-dominating decks (stax, high-power combo) and decks that are
 * merely well-built (Voltron, midrange toolbox), which the old unweighted
 * average compressed together. */
// Single source of truth for Spark's weights (they sum to 5, so the result
// stays on the same 1-10 scale as the axes). The Spark explainer popup reads
// this same object, so what it shows can never drift from the real formula.
export const SPARK_WEIGHTS = {
  speed: 0.75,
  consistency: 0.75,
  versatility: 0.75,
  disruption: 1.25,
  powerLevel: 1.5,
};

export function computeSpark(
  speed: number,
  consistency: number,
  versatility: number,
  disruption: number,
  powerLevel: number,
): number {
  const W = SPARK_WEIGHTS;
  const raw =
    (speed * W.speed +
      consistency * W.consistency +
      versatility * W.versatility +
      disruption * W.disruption +
      powerLevel * W.powerLevel) /
    5;
  return Math.round(raw * 10) / 10;
}

/** Soft spirit band (Core / Focused / Tuned). Re-fitted Oct 12, 2026 against the three-tier reference set
 * (153 precons, 36 tuned decks, 20 cEDH lists): the old cut-offs (Spark 3.7 / 5.8, one / three signals) put
 * every precon in Focused or Tuned. The tool-signal count separates the tiers best (precons median 2 and never
 * above 4; tuned decks median 5; cEDH median 6), so it carries the bands together with Spark. With these
 * values: 123 of 153 precons Core, 30 Focused, none Tuned; 34 of 36 tuned decks Tuned; all 20 cEDH lists Tuned.
 * There is deliberately no cEDH band (see the "could function at a cEDH level" note in detectBracket). */
export const SPIRIT_TUNED_SPARK = 6.0,
  SPIRIT_TUNED_SIGNALS = 5;

export const SPIRIT_FOCUSED_SPARK = 5.0,
  SPIRIT_FOCUSED_SIGNALS = 3;

export interface SpiritBand {
  band: "Tuned" | "Focused" | "Core";
  detail: string;
  why: string;
  signals: string[];
}

export function detectSpiritBand(
  agg: DeckAnalysis,
  commandSpark: number | null | undefined,
): SpiritBand {
  const spark = commandSpark || 0;
  const firedSignals: string[] = [];
  if (agg.tutor >= 5) firedSignals.push(`${agg.tutor} tutors`);
  const weightedFastManaForCraft = (agg.fastMana || 0) + (agg.fastManaExtended || 0) * 0.5;
  if (weightedFastManaForCraft >= 3) {
    firedSignals.push(
      `${agg.fastMana} fast mana source${agg.fastMana === 1 ? "" : "s"}${agg.fastManaExtended ? ` (+${agg.fastManaExtended} extended)` : ""}`,
    );
  }
  if ((agg.engineRatio || 0) >= 0.18)
    firedSignals.push(
      `a dense engine package (${Math.round((agg.engineRatio || 0) * 100)}% of nonland cards)`,
    );
  if (agg.freeInteraction >= 2) firedSignals.push(`${agg.freeInteraction} free interaction spells`);
  if (agg.draw >= 12) firedSignals.push(`${agg.draw} card draw sources`);
  if ((agg.stax || 0) >= 8) firedSignals.push(`${agg.stax} stax effects`);
  if (agg.gameChangers.length >= 1) {
    firedSignals.push(
      `${agg.gameChangers.length} Game Changer${agg.gameChangers.length > 1 ? "s" : ""} (${agg.gameChangers.slice(0, 4).join(", ")}${agg.gameChangers.length > 4 ? "…" : ""})`,
    );
  }
  // Multi-piece combos (3+ cards) don't trigger the official Bracket 4
  // threshold on their own (see detectBracket) but a deck that can still
  // assemble one is genuinely sharper than one that can't -- this is
  // exactly the kind of "sharp even when official signals stay in B1-2"
  // case the Tuned/Focused bands exist to catch.
  const spiritCurve = computeManaCurve(agg);
  const multiPieceCombos = (agg.detectedComboDetails || []).filter(
    (c) => c.pieceCount >= 3 || (c.pieceCount === 2 && !comboIsEarly(c, spiritCurve)),
  );
  if (multiPieceCombos.length >= 1) {
    firedSignals.push(
      `${multiPieceCombos.length} slower combo line${multiPieceCombos.length > 1 ? "s" : ""} (3+ cards, or two cards that come online after turn ${EARLY_COMBO_BY_TURN})`,
    );
  }
  const tunedSignals = firedSignals.length;

  if (spark >= SPIRIT_TUNED_SPARK || tunedSignals >= SPIRIT_TUNED_SIGNALS) {
    const why =
      tunedSignals >= SPIRIT_TUNED_SIGNALS
        ? `Driven by ${firedSignals.length} tuning signals: ${firedSignals.join("; ")}.`
        : `Driven by a high overall Command Spark (${spark.toFixed(1)}) even without ${SPIRIT_TUNED_SIGNALS} individual tool signals crossing threshold.`;
    return {
      band: "Tuned",
      detail:
        "Dense high-impact tools (tutors, fast mana, free interaction, engines, or a real stax package) — sharp even when official signals stay in B1–2.",
      why,
      signals: firedSignals,
    };
  }
  if (spark >= SPIRIT_FOCUSED_SPARK || tunedSignals >= SPIRIT_FOCUSED_SIGNALS) {
    const why =
      tunedSignals >= SPIRIT_FOCUSED_SIGNALS
        ? `Driven by ${firedSignals.length} tool signals: ${firedSignals.join("; ")}.`
        : `Driven by a moderate overall Command Spark (${spark.toFixed(1)}), without ${SPIRIT_FOCUSED_SIGNALS} individual tool signals crossing threshold.`;
    return {
      band: "Focused",
      detail:
        "Clear plan and moderate support — a step up from precon-level, usually a comfortable Balanced-night seat.",
      why,
      signals: firedSignals,
    };
  }
  return {
    band: "Core",
    detail: "Lighter density of premium tools — closer to precon or casual theme energy.",
    why: `Fewer than ${SPIRIT_FOCUSED_SIGNALS} tool signals${tunedSignals ? " (" + firedSignals.join("; ") + ")" : ""} and a Command Spark of ${spark.toFixed(1)}, below the Focused line.`,
    signals: firedSignals,
  };
}
