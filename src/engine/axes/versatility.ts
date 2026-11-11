import type { DeckAnalysis } from "../analyze-tallies.ts";
import { clamp } from "./shared.ts";

export function scoreVersatility(agg: DeckAnalysis, winConCount: number): number {
  // Blended: how many ways can this deck win, AND how many different jobs can
  // it do along the way. Win-condition count still anchors the score (a deck
  // with two real win paths should clearly outscore one with a single fragile
  // plan), but functional breadth (ramp/draw/removal/tutor/protection/theme
  // roles/modal cards) now meaningfully separates decks that share the same
  // win-con count — a toolbox deck reads as more versatile than a one-note
  // beatdown pile, even if both "just" attack to win.
  //
  // Non-combo win conditions (alt-win, mill, infect, burn, Voltron,
  // aristocrats, extra turns) get flat, now-capped credit per entry —
  // capped because this was previously the only uncapped term in the whole
  // formula, letting a deck with several detected win conditions blow past
  // every other term's scale. Combos get their own, reliability-weighted
  // credit instead of flat per-entry credit: a combo sitting unsupported in
  // a low-draw, low-tutor pile is a real but fragile plan, while one that's
  // commander-anchored, tutored-for, redundant, and protected is a much
  // more genuine second win path — see detectedComboDetails.reliability.
  const comboDetails = agg.detectedComboDetails || [];
  const nonComboWinConCount = Math.max(0, (winConCount || 0) - comboDetails.length);
  const winPts = Math.min(nonComboWinConCount * 1.5, 3.0);
  const comboReliabilitySum = comboDetails.reduce((s, c) => s + (c.reliability || 1), 0);
  const comboVersatilityPts = Math.min(comboReliabilitySum * 0.7, 2.5);
  const featurePts = Math.min((agg.versatilityFeatures || 0) * 0.18, 3.0);
  const modePts = Math.min((agg.versatilityModes || 0) * 0.08, 1.0);
  const drawPts = Math.min((agg.drawWeighted || agg.draw) * 0.04, 0.6);
  // Sacrifice outlets are a real functional-breadth signal previously
  // untracked here entirely -- they let a deck respond to removal by
  // sacrificing in response, and often fuel a second plan (aristocrats)
  // alongside whatever the deck's main gameplan is.
  const sacOutletPts = Math.min((agg.sacOutletsWeighted || agg.sacOutlets || 0) * 0.05, 0.5);
  // (Previously a small, unexplained ramp bonus lived here too -- removed
  // for the same reason as in Consistency: no stated case for why raw ramp
  // count specifically broadens what a deck can DO, versus how fast it
  // gets there, which Speed already covers.)
  const raw = 1.0 + winPts + comboVersatilityPts + featurePts + modePts + drawPts + sacOutletPts;
  return clamp(Math.round(raw * 10) / 10);
}
