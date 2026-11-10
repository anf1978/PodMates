import type { DeckAnalysis } from "./analyze-tallies.ts";
import type { ComboDetail, ManaCurvePoint, WinCondition } from "./types.ts";
import { computeManaCurve, expectedCardsSeenByTurn } from "./axes/shared.ts";

// ---- Win condition detection ----
// Estimates how likely a detected combo is to be both ASSEMBLED (every
// non-commander piece drawn or tutored for) and AFFORDABLE (the mana curve
// covers its total cost) by turn 10, a reasonable "typical game" horizon.
// Returns a probability, not a binary yes/no -- finding one specific
// non-land card via pure draw genuinely tops out well under 50% within a
// normal game even with real tutor/draw support (verified against real
// decks while building this), so a strict threshold would make a
// meaningfully-supported combo sound falsely dead. Also returns the
// earliest turn crossing a lower "starting to be realistic" bar, when one
// exists, for a more specific readout alongside the headline number.
// Deliberately approximate: independent-find assumption per piece, tutors
// as a flat boost rather than tracking which tutor could find which piece
// -- consistent with every other simplified estimate in this app.
export function estimateComboOnlineTurn(
  comboDetail: Pick<ComboDetail, "commanderPiece" | "cards" | "totalCastCost">,
  agg: Pick<DeckAnalysis, "tutor" | "draw">,
  manaCurve: readonly ManaCurvePoint[],
): { firstRealisticTurn: number | null; probabilityAtTurn10: number } {
  const nonCommanderPieceCount = comboDetail.commanderPiece
    ? Math.max(0, comboDetail.cards.length - 1)
    : comboDetail.cards.length;
  const tutorBoost = Math.min((agg.tutor || 0) * 0.15, 1.5);
  const REALISTIC_BAR = 0.35;

  let firstRealisticTurn: number | null = null;
  let probabilityAtTurn10 = 0;
  for (let turn = 0; turn <= 10; turn++) {
    const cardsSeen = expectedCardsSeenByTurn(turn, agg);
    const effectiveSeen = cardsSeen + tutorBoost * turn;
    const pFindOnePiece = Math.min(1, effectiveSeen / 99);
    const pFindAll =
      nonCommanderPieceCount > 0 ? Math.pow(pFindOnePiece, nonCommanderPieceCount) : 1;

    const manaAtTurn = (manaCurve[turn] && manaCurve[turn].mana) || 0;
    const canAfford = manaAtTurn >= (comboDetail.totalCastCost || 0);
    const pOnline = canAfford ? pFindAll : 0;

    if (firstRealisticTurn === null && pOnline >= REALISTIC_BAR) firstRealisticTurn = turn;
    if (turn === 10) probabilityAtTurn10 = pOnline;
  }
  return { firstRealisticTurn, probabilityAtTurn10 };
}

export function detectWinCondition(agg: DeckAnalysis): WinCondition[] {
  const results: WinCondition[] = [];

  if (agg.altWinCards.length > 0) {
    results.push({
      label: "Alternate win condition",
      detail: `Explicit win-the-game text found on: ${agg.altWinCards.join(", ")}`,
      confidence: "high",
      cards: agg.altWinCards,
    });
  }

  // Each known combo gets its own entry rather than being lumped into one
  // string — a deck with 3 combos should show 3 distinct lines, not one
  // semicolon-joined blob.
  const manaCurveForCombos = agg.detectedComboDetails.length ? computeManaCurve(agg) : null;
  for (const combo of agg.detectedComboDetails) {
    const reliabilityNote = combo.commanderPiece
      ? " Your commander is one of the pieces, so half of this is always in play."
      : combo.reliability >= 1.7
        ? " Well-supported by this deck\u2019s tutors/draw/protection, so it\u2019s genuinely reachable."
        : " Sitting in the 99 without much tutor or draw support behind it, so treat this as a possibility rather than a plan.";
    const onlineTurn = estimateComboOnlineTurn(combo, agg, manaCurveForCombos as ManaCurvePoint[]);
    const pctAtTurn10 = Math.round(onlineTurn.probabilityAtTurn10 * 100);
    const timingNote =
      onlineTurn.firstRealisticTurn !== null
        ? ` Starts becoming realistic around turn ${onlineTurn.firstRealisticTurn}, roughly ${pctAtTurn10}% likely to be assembled and affordable by turn 10.`
        : ` Roughly ${pctAtTurn10}% likely to be assembled and affordable by turn 10 based on this deck's draw/tutor/mana support -- possible, but don't plan around finding it early.`;
    results.push({
      label: combo.infinite ? "Infinite combo" : "Known combo",
      detail:
        (combo.outcome
          ? `${combo.cards.join(" + ")} → ${combo.outcome}.`
          : `${combo.cards.join(" + ")}.`) +
        reliabilityNote +
        timingNote,
      confidence: "high",
      cards: combo.cards,
    });
  }

  if (agg.millOpponentCount >= 4) {
    results.push({
      label: "Mill",
      detail: `${agg.millOpponentCount} cards that mill opponents' libraries — likely a deck-out plan.`,
      confidence: agg.millOpponentCount >= 8 ? "high" : "medium",
    });
  }

  if (agg.infectCount >= 3) {
    results.push({
      label: "Infect / Poison",
      detail: `${agg.infectCount} cards involving infect or poison counters — likely a 10-poison plan.`,
      confidence: agg.infectCount >= 6 ? "high" : "medium",
    });
  }

  if (agg.burnFaceCount >= 6) {
    results.push({
      label: "Direct damage (burn)",
      detail: `${agg.burnFaceCount} cards that deal damage straight to players — likely a burn-to-face plan.`,
      confidence: agg.burnFaceCount >= 10 ? "high" : "medium",
    });
  }

  // Voltron: enough Auras/Equipment to be stacking buffs onto a small number
  // of threats (usually the commander), rather than a normal creature base.
  const voltronPieces = (agg.auraCount || 0) + (agg.equipmentCount || 0);
  if (voltronPieces >= 8) {
    results.push({
      label: "Voltron (commander damage)",
      detail: `${voltronPieces} Auras/Equipment (${agg.auraCount} Auras, ${agg.equipmentCount} Equipment) — likely stacking buffs onto one or two threats to close with combat/commander damage.`,
      confidence: voltronPieces >= 14 ? "high" : "medium",
    });
  }

  // Aristocrats / slow drain: enough life-loss triggers to grind opponents
  // out over the course of a game, distinct from a dedicated burn plan.
  // Skipped when "Direct damage (burn)" already fired — drain cascades from
  // punisher/burnFace tags, so for a burn-heavy deck these would otherwise
  // describe the same cards twice under two different labels.
  const burnAlreadyShown = results.some((r) => r.label === "Direct damage (burn)");
  if (!burnAlreadyShown && (agg.themes.drain || 0) >= 6) {
    results.push({
      label: "Aristocrats / slow drain",
      detail: `${agg.themes.drain} cards that drain life or punish deaths — likely wins by grinding the table down over time rather than one big hit.`,
      confidence: agg.themes.drain >= 10 ? "high" : "medium",
    });
  }

  // Extra turns: enough "take an extra turn" effects to plausibly chain
  // into a time-walk lockout, even without a listed infinite combo.
  if ((agg.extraTurn || 0) >= 3) {
    results.push({
      label: "Extra turns",
      detail: `${agg.extraTurn} extra-turn effects — capable of stacking turns for repeated attacks or simply denying opponents theirs.`,
      confidence: agg.extraTurn >= 5 ? "high" : "medium",
    });
  }

  if (results.length === 0) {
    results.push({
      label: "Combat damage (creature-based)",
      detail: `No alternate win condition detected — this deck most likely wins through combat damage from its creature base.`,
      confidence: "fallback",
    });
  }

  return results;
}
