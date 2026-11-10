import type { DeckAnalysis } from "../analyze-tallies.ts";
import { clamp, computeManaCurve } from "./shared.ts";

export function scoreSpeed(agg: DeckAnalysis, hasSpecificWinCon: boolean): number {
  // Ramp + fast mana define speed; early creatures alone do not (avoids tribal inflation).
  const rampPts = Math.min((agg.rampWeighted || agg.ramp) * 0.22, 2.2);

  // Fast mana's value isn't just "how many fast mana cards" — it depends on
  // the curated tier (extended counts at half weight — those cards are
  // more conditional/deck-dependent than the core list) AND on whether the
  // deck actually has somewhere to spend the acceleration. A deck can't
  // just be full of fast mana and call itself fast — that mana has to
  // build toward executing a real game plan faster, or it's just extra
  // resources with nowhere useful to go. Two modifiers capture this:
  //
  // 1. Redundancy: value per additional fast-mana card diminishes past a
  //    reasonable amount (6, weighted) — the first several pieces get you
  //    to your plan meaningfully faster; the tenth doesn't add much a
  //    reasonable curve-out wasn't already accomplishing.
  // 2. Focus: how much of a real game plan is actually there to accelerate
  //    toward. Built from three signals — a real (non-fallback) win
  //    condition, how much of the deck functions as one connected synergy
  //    cluster rather than a pile of separately-good cards, and how
  //    aligned the deck is with its own commander's plan. A deck with no
  //    real focus still gets partial credit (fast mana into "attack with
  //    creatures" is still something), but a deck with a sharp plan gets
  //    meaningfully more value per fast-mana card than one without —
  //    otherwise the fast mana is just getting you to Nowhereville faster.
  const weightedFastMana = (agg.fastMana || 0) + (agg.fastManaExtended || 0) * 0.5;
  const REDUNDANCY_THRESHOLD = 6;
  const effectiveFastMana =
    weightedFastMana <= REDUNDANCY_THRESHOLD
      ? weightedFastMana
      : REDUNDANCY_THRESHOLD + Math.sqrt(weightedFastMana - REDUNDANCY_THRESHOLD);
  const nonland = Math.max(agg.nonlandCount || 1, 1);
  const clusterRatio = Math.min((agg.synergyTopClusterSize || 0) / (nonland * 0.35), 1);
  const alignRatio = Math.min(agg.commanderAlignment || 0, 1);
  const focusScore = Math.min(
    0.35 + (hasSpecificWinCon ? 0.3 : 0) + clusterRatio * 0.2 + alignRatio * 0.15,
    1.0,
  );
  const fastPts = Math.min(effectiveFastMana * focusScore * 0.75, 3.5);

  // Trigger-payoff synergy: a ritual IS a "cast a spell" event, and a mana
  // dork IS a "creature enters" event (and later, if it dies, a "creature
  // dies" event too). A deck that pairs its ramp with real payoffs for
  // those events gets extra value per ramp card beyond the mana alone —
  // Guttersnipe turns every ritual into damage, Purphoros turns every dork
  // into damage. Bounded by the smaller of the two counts, since the
  // synergy needs both pieces: 10 payoffs don't help if there's only one
  // ritual around to trigger them, and vice versa.
  const castSynergyBonus = Math.min(agg.ritual || 0, agg.castTriggerPayoff || 0) * 0.15;
  const creatureSynergyBonus = Math.min(agg.manaDork || 0, agg.creatureEventPayoff || 0) * 0.12;
  const triggerSynergyPts = Math.min(castSynergyBonus + creatureSynergyBonus, 1.0);

  // Cost reducers function like conditional fast mana for whatever the
  // deck is actually trying to cast (Etherium Sculptor for an artifact
  // shell, Baral for spells) -- distinct enough from generic ramp to earn
  // a small dedicated bonus on top of it, castability-weighted like
  // everything else added this round.
  const costReducerPts = Math.min((agg.costReducerWeighted || 0) * 0.18, 0.8);

  // Real curve evidence, not another flat count: how much mana this deck
  // is actually expected to have online by turn 4, a reasonable point for
  // "the game is really getting going" in Commander. A deck sitting at the
  // typical baseline (~5 mana by then, roughly 4 land drops plus a piece
  // or two) gets no bonus here -- the existing ramp/fastMana terms above
  // already credit that. This only rewards genuine acceleration beyond
  // the baseline, which is exactly what a flat per-card count can't see:
  // the ABILITY TO SPEND that mana, not just the count of cards that
  // produce it.
  const manaCurve = computeManaCurve(agg);
  const manaAtTurn4 = (manaCurve[4] && manaCurve[4].mana) || 0;
  const curveBonusPts = Math.min(Math.max(manaAtTurn4 - 5.0, 0) * 0.3, 1.0);

  const earlyPts = Math.min((agg.earlyDensity || 0) * 2.0, 1.2); // soft bonus only
  const curvePen = Math.min(
    Math.max((agg.avgCmcLibrary != null ? agg.avgCmcLibrary : agg.avgCmc) - 2.8, 0) * 0.45,
    1.5,
  );
  const raw =
    1.4 +
    rampPts +
    fastPts +
    triggerSynergyPts +
    costReducerPts +
    curveBonusPts +
    earlyPts +
    Math.min((agg.reanimateWeighted || agg.reanimate) * 0.25, 0.8) -
    curvePen;
  return clamp(Math.round(raw * 10) / 10);
}
