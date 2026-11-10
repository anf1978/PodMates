import type { DeckAnalysis } from "../analyze-tallies.ts";
import { clamp } from "./shared.ts";

export function scoreDisruption(agg: DeckAnalysis): number {
  // Free interaction and stax/MLD define the top. Everything below that
  // isn't already cost-filtered by its own definition (free/cheap
  // interaction are by construction already cheap; expensiveInteraction is
  // already the "expensive" bucket, so weighting it again would double-
  // penalize) is castability-weighted -- a 7-mana wipe or counterspell is
  // a real, powerful effect when it resolves, but a less reliable piece
  // of disruption over a typical game than a cheap equivalent.
  const freePts = Math.min(agg.freeInteraction * 1.1, 4.0);
  const cheapPts = Math.min(agg.cheapInteraction * 0.18, 1.5);
  const counterPts = Math.min((agg.counterMagicWeighted || agg.counterMagic) * 0.22, 1.4);
  const staxPts = Math.min((agg.staxWeighted || agg.stax) * 0.35, 1.8);
  const discardPts = Math.min((agg.discardWeighted || agg.discard) * 0.25, 1.2);
  const mldPts = Math.min((agg.mldWeighted || agg.mld) * 1.8, 3.5);
  const removalPts = Math.min((agg.removalWeighted || agg.removal) * 0.04, 0.8);
  // Board wipes are one of the most table-defining disruptive effects that
  // exist -- previously untracked here entirely. A deck built around
  // resetting the board should read as meaningfully more disruptive than
  // one without, distinct from targeted removal (removalPts above).
  const wipePts = Math.min((agg.wipeWeighted || agg.wipe || 0) * 0.9, 3.0);
  // -1/-1 counters frequently function as an attrition/removal tool
  // (permanently weakening or killing creatures), so a modest contribution
  // here is warranted — weighted on par with raw removal count.
  const minusCounterPts = Math.min((agg.themes.minusCounters || 0) * 0.06, 0.8);
  const raw =
    1.2 +
    freePts +
    cheapPts +
    counterPts +
    staxPts +
    discardPts +
    mldPts +
    wipePts +
    Math.min(agg.expensiveInteraction * 0.08, 0.6) +
    removalPts +
    Math.min((agg.punisherWeighted || agg.punisher) * 0.2, 0.6) +
    minusCounterPts;
  return clamp(Math.round(raw * 10) / 10);
}
