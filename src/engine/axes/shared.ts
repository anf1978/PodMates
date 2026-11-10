import type { DeckTallies } from "../analyze-tallies.ts";
import type { ManaCurvePoint } from "../types.ts";
// ---- Scoring: 1-10 clamp helper ----
// A card's mana cost affects how likely it is to actually get cast and
// matter in a given game -- not as a hard cliff, but a gradual taper.
// Cards at 4 CMC or below are reliably castable in a normal Commander
// game; above that, each additional mana makes the card compete harder
// against everything else you'd rather be doing that turn, and arrive
// later relative to how long games actually last. This deliberately
// floors at 0.5 rather than going to zero -- an expensive board wipe or
// tutor is still a real, powerful effect when it does resolve, just a
// less reliable one than a cheap equivalent, not a worthless one.
export function castabilityWeight(cmc: number): number {
  const c = cmc || 0;
  if (c <= 4) return 1.0;
  return Math.max(0.5, 1.0 - (c - 4) * 0.12);
}

export function clamp(n: number, min = 1, max = 10): number {
  return Math.max(min, Math.min(max, n));
}

// Expected mana available per turn, turns 0 (opening hand) through 10 --
// hypergeometric expectation, not a randomized simulation, so it's fast
// and deterministic (same spirit as everything else in this app). Models
// an idealized deck playing land-and-ramp optimally every turn: no
// mulligans, no opponent interaction, no specific drawn hand -- the same
// simplifying assumptions applied identically to every deck being
// compared, which is what makes it a fair comparative signal even though
// it isn't a prediction of any single game.
// How many cards has this deck's pilot likely SEEN (opening hand + draws)
// by a given turn, accounting for the deck's own card draw density -- a
// deck loaded with draw spells genuinely sees more of its list by turn N
// than a deck running the bare 1-card-per-turn baseline, and both the
// mana curve and combo-assembly odds below should reflect that rather
// than assuming every deck draws identically. Draw is a flat per-card
// tally (not draw-quantity-per-card), so this stays a deliberately simple
// multiplier on the baseline rate rather than a precise per-spell model --
// consistent with every other tiered estimate in this app.
export function expectedCardsSeenByTurn(turn: number, agg: Pick<DeckTallies, "draw">): number {
  const extraDrawRate = Math.min((agg.draw || 0) / 40, 0.5);
  return 7 + turn * (1 + extraDrawRate);
}

export function computeManaCurve(
  agg: Pick<DeckTallies, "draw" | "landCount" | "manaCurveContributors">,
): ManaCurvePoint[] {
  const librarySize = 99; // standard Commander deck size, excluding the commander itself
  const landCount = agg.landCount || 0;
  const contributors = agg.manaCurveContributors || [];
  const curve: ManaCurvePoint[] = [];

  for (let turn = 0; turn <= 10; turn++) {
    const cardsSeen = expectedCardsSeenByTurn(turn, agg);
    const expectedLandsDrawn = cardsSeen * (landCount / librarySize);
    const landsInPlay = Math.min(turn, expectedLandsDrawn); // capped by the one-land-per-turn rule

    let rampMana = 0;
    let multiplierBoost = 0;
    for (const piece of contributors) {
      if (piece.cmc > turn) continue; // can't have been cast yet regardless of being drawn
      // The commander needs no drawing: it is available from the turn it can be cast.
      const pDrawn = piece.isCommander ? 1 : Math.min(1, cardsSeen / librarySize); // probability this specific copy has been seen by now
      if (piece.isMultiplier) {
        multiplierBoost += pDrawn * 0.5; // each multiplier scales existing production, not additive
      } else {
        rampMana += pDrawn * piece.output;
      }
    }

    const baseMana = landsInPlay + rampMana;
    const totalMana = baseMana * (1 + Math.min(multiplierBoost, 1.5)); // cap compounding at +150%
    curve.push({ turn, mana: Math.round(totalMana * 10) / 10 });
  }
  return curve;
}
