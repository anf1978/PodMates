import type { DeckAnalysis } from "./analyze-tallies.ts";
import type { SpiritBand } from "./spark.ts";
import type { ComboDetail, ManaCurvePoint } from "./types.ts";
import { scorePowerLevel } from "./axes/power-level.ts";
import { computeManaCurve } from "./axes/shared.ts";
import { detectSpiritBand } from "./spark.ts";

// ---- Bracket rules that depend on timing and quantity (Oct 2026) ----
// Wizards' Oct 21, 2025 update expects at least six turns of play in Bracket 3 and at least four in
// Bracket 4 (soft expectations, not strict limits; the original beta said no early-game two-card combos in
// Bracket 3). So a two-card combo that can't win before turn six fits Bracket 3; Bracket 4 has no such limit. So a two-card combo only forces
// Bracket 4 when THIS deck could realistically have it online by turn five.
// "Online" is judged with the deck's own mana model (computeManaCurve): either both
// pieces fit in one turn's mana, or they are cast on consecutive turns, cheapest
// first, each paid from that turn's mana. It looks only at mana, not at drawing the
// pieces, so it errs on the side of "could happen" -- a cheap combo in a deck with no
// tutors still counts as early, because that is the fast hand Bracket 4 is about.
export const EARLY_COMBO_BY_TURN = 5;

// Extra turns: Brackets 2 and 3 allow a few that are not chained or looped. Wizards gives
// no exact number, so these two cut-offs are THIS APP'S JUDGMENT, not an official figure:
// from 3 extra-turn cards the deck is past "a few" (at least Bracket 3); from 5 it can
// realistically chain them (Bracket 4).
export const EXTRA_TURN_B3_AT = 3;

export const EXTRA_TURN_B4_AT = 5;

export function earliestComboTurn(
  detail: Pick<ComboDetail, "totalCastCost" | "pieceCosts" | "pieceCount">,
  manaCurve: readonly ManaCurvePoint[],
): number | null {
  const manaAt = (t: number) => (manaCurve[t] && manaCurve[t].mana) || 0;
  const total = detail.totalCastCost || 0;
  let costs = detail.pieceCosts && detail.pieceCosts.length ? detail.pieceCosts.slice() : null;
  if (!costs) {
    const n = Math.max(detail.pieceCount || 2, 1);
    costs = Array(n).fill(total / n);
  }
  costs.sort((x, y) => x - y);
  const n = costs.length;
  for (let T = 1; T <= 10; T++) {
    if (manaAt(T) >= total) return T; // everything fits in one turn
    let ok = true; // or one piece per turn, ending on turn T
    for (let k = 0; k < n; k++) {
      const t = T - (n - 1 - k);
      if (t < 1 || manaAt(t) < (costs[k] as number)) {
        ok = false;
        break;
      }
    }
    if (ok) return T;
  }
  return null; // not within ten turns
}

export function comboIsEarly(
  detail: Pick<ComboDetail, "totalCastCost" | "pieceCosts" | "pieceCount">,
  manaCurve: readonly ManaCurvePoint[],
): boolean {
  const t = earliestComboTurn(detail, manaCurve);
  return t !== null && t <= EARLY_COMBO_BY_TURN;
}

// "Could function at a cEDH level": NOT a Bracket 5 band (cEDH is about the table you play at, which a
// decklist cannot show). It only says the deck's numbers sit in the range of the 20 competitive lists in the
// reference set. Fitted Oct 12, 2026: true for 18 of 20 cEDH lists, 10 of 36 tuned decks and 0 of 153 precons.
export const CEDH_CAPABLE_MIN_SPARK = 8.0,
  CEDH_CAPABLE_MIN_POWER = 9.5,
  CEDH_CAPABLE_MIN_SIGNALS = 5;

export interface BracketResult {
  bracket: string;
  bracketKey: string;
  spirit: SpiritBand;
  reasoning: (string | null)[];
  note: string | null;
  cedhCapable?: boolean;
  cedhNote?: string | null;
}

export function detectBracket(agg: DeckAnalysis, commandSpark: number): BracketResult {
  const r: BracketResult = detectBracketCore(agg, commandSpark);
  const power = scorePowerLevel(agg);
  const sig = r.spirit && r.spirit.signals ? r.spirit.signals.length : 0;
  r.cedhCapable =
    commandSpark >= CEDH_CAPABLE_MIN_SPARK &&
    power >= CEDH_CAPABLE_MIN_POWER &&
    sig >= CEDH_CAPABLE_MIN_SIGNALS;
  r.cedhNote = r.cedhCapable
    ? `Its numbers (Command Spark ${commandSpark.toFixed(1)}, Power Level ${power.toFixed(1)}, ${sig} tuning signals) sit in the range of the competitive tournament lists PodMates compares against, so this deck could function at a cEDH level. Whether it counts as Bracket 5 depends on how your table plays, not on the cards alone.`
    : null;
  return r;
}

export function detectBracketCore(agg: DeckAnalysis, commandSpark: number): BracketResult {
  const gcCount = agg.gameChangers.length;
  const hasMld = agg.mld > 0;
  // Only a TRUE two-card combo can drive the automatic Bracket 4 bump, and only an EARLY one
  // (see EARLY_COMBO_BY_TURN above): official Bracket 3 explicitly allows a two-card combo that
  // can't be assembled and won before turn six. A multi-piece combo (3+ cards) is meaningfully
  // harder to assemble and disrupt, so it is not an automatic Bracket 4 on its own either.
  // Both kinds are still surfaced (see detectSpiritBand).
  const comboDetails = agg.detectedComboDetails || [];
  const manaCurve = computeManaCurve(agg);
  type TwoCardLine = { name: string; turn: number | null; loop?: boolean };
  const earlyTwoCard: TwoCardLine[] = [],
    lateTwoCard: TwoCardLine[] = [],
    multiPieceComboNames: string[] = [];
  comboDetails.forEach((c, i) => {
    const name = agg.detectedCombos[i] as string;
    if (c.pieceCount === 2 && c.bracketRelevant !== false) {
      const turn = earliestComboTurn(c, manaCurve);
      (turn !== null && turn <= EARLY_COMBO_BY_TURN && c.winsAlone !== false
        ? earlyTwoCard
        : lateTwoCard
      ).push({ name, turn });
    } else if (c.pieceCount >= 3) multiPieceComboNames.push(name);
  });
  // Two-card infinite value loops (infinite triggers/casts, no win by themselves): house rule says any two-card
  // infinite combo makes a deck Bracket 3 at least, but they never push to Bracket 4 on speed.
  (agg.infiniteLoopTwoCard || []).forEach((l) =>
    lateTwoCard.push({ name: l.name, turn: null, loop: true }),
  );
  const hasFastCombo = earlyTwoCard.length > 0;
  const extraTurns = agg.extraTurn || 0;
  const extraTurnChain = extraTurns >= EXTRA_TURN_B4_AT;
  const extraTurnPackage = extraTurns >= EXTRA_TURN_B3_AT;
  const spirit = detectSpiritBand(agg, commandSpark);
  const turnWord = (t: number | null) =>
    t === null ? "much later than turn ten" : `about turn ${t}`;

  if (hasMld || hasFastCombo || gcCount >= 4 || extraTurnChain) {
    return {
      bracket: "4 (Optimized)",
      bracketKey: "4",
      spirit,
      reasoning: [
        hasMld ? `Contains mass land denial (${agg.mld} card(s)).` : null,
        hasFastCombo
          ? `Contains a known two-card combo that could be online by about turn ${EARLY_COMBO_BY_TURN} (${earlyTwoCard.map((x) => `${x.name}, ${turnWord(x.turn)}`).join("; ")}). Wizards expects Bracket 3 games to last at least six turns and Bracket 4 games at least four, so a combo this fast fits Bracket 4. (A guideline, not a hard rule.)`
          : null,
        gcCount >= 4 ? `Contains ${gcCount} Game Changers (over the Bracket 3 limit of 3).` : null,
        extraTurnChain
          ? `Contains ${extraTurns} extra-turn cards, enough to chain them. Wizards allows only a few extra turns in lower brackets, never chained; the exact cut-off of five is PodMates' own judgment.`
          : null,
        lateTwoCard.length
          ? `Also contains ${lateTwoCard.length} two-card combo line(s) too slow to count on their own (${lateTwoCard.map((x) => x.name).join("; ")}).`
          : null,
        multiPieceComboNames.length
          ? `Also contains ${multiPieceComboNames.length} multi-piece combo line(s) (3+ cards): ${multiPieceComboNames.join("; ")}.`
          : null,
      ].filter(Boolean),
      note: 'Bracket 5 (cEDH) cannot be confirmed from a decklist alone — it depends on the local competitive meta, not just card choices. If the numbers reach the competitive range a separate line says so ("could function at a cEDH level"); if this deck is built for cEDH play, self-identify it as such.',
    };
  }

  if (gcCount >= 1 || lateTwoCard.length || extraTurnPackage) {
    return {
      bracket: "3 (Upgraded)",
      bracketKey: "3",
      spirit,
      reasoning: [
        gcCount >= 1
          ? `Contains ${gcCount} Game Changer(s): ${agg.gameChangers.join(", ")}.`
          : null,
        lateTwoCard.length
          ? `Contains ${lateTwoCard.length} two-card combo line(s) that either would not be online before turn six in this deck or win nothing by themselves (${lateTwoCard.map((x) => `${x.name}, ${x.loop ? "an infinite loop that wins nothing by itself" : turnWord(x.turn)}`).join("; ")}). Any two-card infinite combo makes a deck Bracket 3 at least; only one that wins on its own and could be online by about turn five would be Bracket 4.`
          : null,
        extraTurnPackage
          ? `Contains ${extraTurns} extra-turn cards: more than a few. Wizards gives no number; the cut-off of three is PodMates' own judgment, so treat this as a hint, not a rule.`
          : null,
        multiPieceComboNames.length
          ? `Contains ${multiPieceComboNames.length} multi-piece combo line(s) requiring 3+ specific cards together (${multiPieceComboNames.join("; ")}) -- not an automatic Bracket 4, but see Spirit Band above.`
          : null,
        !lateTwoCard.length && !extraTurnPackage && !multiPieceComboNames.length
          ? "No mass land denial, early two-card combos or extra-turn chains detected."
          : null,
      ].filter(Boolean),
      note: null,
    };
  }

  return {
    bracket: "1–2 (Exhibition / Core)",
    bracketKey: "1-2",
    spirit,
    reasoning: [
      multiPieceComboNames.length
        ? `No Game Changers or mass land denial detected. Contains ${multiPieceComboNames.length} multi-piece combo line(s) requiring 3+ specific cards together (${multiPieceComboNames.join("; ")}), which isn't an automatic Bracket 4 -- see Spirit Band above.`
        : "No Game Changers, mass land denial, extra-turn chains or known combo lines detected.",
    ],
    note: "Official brackets alone cannot show the real range inside B1–2 — see Deck Craft in the Table Vibe box for a finer read.",
  };
}
