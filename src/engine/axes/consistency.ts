import type { DeckAnalysis } from "../analyze-tallies.ts";
import { clamp } from "./shared.ts";

export function scoreConsistency(agg: DeckAnalysis): number {
  // Tutors matter -- castability-weighted, since a tutor is only as good
  // as your ability to actually cast it before the game's decided; theme
  // redundancy and engines help but are capped hard.
  const tutorPts = Math.min((agg.tutorWeighted || agg.tutor) * 0.55, 2.5);
  const drawPts = Math.min((agg.drawWeighted || agg.draw) * 0.08, 1.2);
  const redun = Math.min((agg.redundancy || 0) * 0.06, 1.0);
  const eng = Math.min((agg.engineRatio || 0) * 3.0, 1.2);
  const prot = Math.min((agg.protectionWeighted || agg.protection) * 0.2, 0.8);
  // (Previously a small, unexplained ramp bonus lived here -- removed. No
  // clear case for why raw ramp count should make a deck more consistent
  // specifically, versus just faster (Speed already covers that), and every
  // other cross-axis signal in this app has a stated reason to be shared.)
  const raw = 1.5 + tutorPts + drawPts + redun + eng + prot;
  return clamp(Math.round(raw * 10) / 10);
}
