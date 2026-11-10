import { HARD_COMBOS, SOFT_SYNERGIES } from "../data/combos.ts";
import type { CardRecord } from "../cards/tuple.ts";
import { comboDisplayWin } from "./combo-outcomes.ts";
import {
  SPELLBOOK_MAX_COMBOS,
  comboNearMisses,
  comboSlotsMatch,
  describeCombo,
  matchSpellbookCombos,
} from "./combos.ts";
import { resolveCommanderName } from "./commanders.ts";
import type { DeckAnalysis } from "./analyze-tallies.ts";
import type { EngineContext } from "./context.ts";
import type { DeckEntry } from "./types.ts";

/** The deck as combo detection sees it (banned cards already removed). */
export interface ComboFrame {
  namesInDeck: Set<string>;
  nameToCard: Map<string, CardRecord>;
  commanders: string[];
  matchedCards: DeckEntry[];
}

/** Curated combos, Spellbook lines, one-card-away combos, synergies and locks. */
export function detectDeckCombos(ctx: EngineContext, agg: DeckAnalysis, deck: ComboFrame): void {
  const { namesInDeck, nameToCard, commanders, matchedCards } = deck;
  // Combo reliability: a detected combo's real danger depends on more than
  // just existing. If the commander is one of the pieces, that half is
  // always available (barring commander tax) — a much stronger reliability
  // signal than any card count. Tutors and draw raise the odds of finding
  // whichever piece(s) you didn't start with. Redundancy (extra matched
  // alternatives within a combo's own OR-slots, e.g. Kiki-Jiki OR Splinter
  // Twin both present) means more paths to the same combo. Protection and
  // counter magic safeguard it once assembled, from both removal and
  // counter-disruption. A combo with none of this support genuinely is
  // less dangerous than one that's commander-anchored, tutored-for, and
  // protected — this reflects that instead of crediting every detected
  // combo identically regardless of how reachable or safe it actually is.
  const tutorSupport = Math.min((agg.tutor || 0) / 8, 1) * 0.4;
  const drawSupport = Math.min((agg.draw || 0) / 15, 1) * 0.3;
  const protectionSupport =
    Math.min(((agg.protection || 0) + (agg.counterMagic || 0)) / 6, 1) * 0.3;

  for (const combo of HARD_COMBOS) {
    if (comboSlotsMatch(namesInDeck, combo)) {
      agg.detectedCombos.push(describeCombo(combo));
      const commanderPiece = combo.s.some((slot) => slot.some((name) => commanders.includes(name)));
      const redundancy = combo.s.reduce((sum, slot) => {
        const matchedInSlot = slot.filter((name) => namesInDeck.has(name)).length;
        return sum + Math.max(0, matchedInSlot - 1);
      }, 0);
      const reliability =
        1.0 +
        (commanderPiece ? 0.5 : 0) +
        Math.min(redundancy * 0.15, 0.3) +
        tutorSupport +
        drawSupport +
        protectionSupport;
      // Total mana needed to cast every piece of the combo, using whichever
      // alternative is actually the one present in THIS deck when a slot
      // has more than one option -- feeds the "when is this online" estimate.
      const totalCastCost = combo.s.reduce((sum, slot) => {
        const matchedName = slot.find((name) => namesInDeck.has(name));
        const card = matchedName ? nameToCard.get(matchedName) : null;
        return sum + (card ? card.m || 0 : 0);
      }, 0);
      // Each piece's own mana value (whichever alternative is in THIS deck),
      // so the Bracket check can ask whether the pieces could be cast in time.
      const pieceCosts = combo.s.map((slot) => {
        const matchedName = slot.find((name) => namesInDeck.has(name));
        const pieceCard = matchedName ? nameToCard.get(matchedName) : null;
        return pieceCard ? pieceCard.m || 0 : 0;
      });
      agg.detectedComboDetails.push({
        cards: combo.s.map((slot) => slot.join(" / ")),
        outcome: combo.o || null,
        infinite: combo.t === "infinite_combo",
        bracketRelevant: combo.t === "infinite_combo", // house rule: ANY two-card infinite combo makes a deck Bracket 3 at least
        winsAlone: comboDisplayWin(combo.o, false), // only a line that ends the game by itself can push to Bracket 4 on speed
        commanderPiece,
        redundancy,
        reliability,
        totalCastCost,
        pieceCosts,
        pieceCount: combo.s.length,
        matchedNames: combo.s
          .map((slot) => slot.find((name) => namesInDeck.has(name)))
          .filter(Boolean) as string[],
      });
    }
  }

  // ---- Commander Spellbook snapshot combos (win or warp the game) -------------
  // Counted exactly like the curated list: they feed the Win Condition list, Versatility,
  // Power and the Bracket rules. A line the curated list already covers is skipped, and so is any
  // line that only extends a smaller one. Only the best SPELLBOOK_MAX_COMBOS lines are fed in so a
  // deck with dozens of overlapping lines cannot run away with the scores; the rest are counted.
  agg.spellbookMatched = 0;
  if (ctx.spellbook) {
    const sbNames = ctx.spellbook.snap.n,
      sbLabels = ctx.spellbook.snap.o;
    const hardSets = agg.detectedComboDetails.map((d) => d.matchedNames || []);
    const cand = [];
    for (const r of matchSpellbookCombos(ctx, namesInDeck)) {
      const names = r[0].map((i) => sbNames[i]);
      if (hardSets.some((h) => h.length && h.every((n) => names.includes(n)))) continue; // curated list already has this line
      const cmdr = names.some((n) => commanders.includes(n));
      if ((r[1] & 3) === 0) {
        (agg.infiniteLoopTwoCard = agg.infiniteLoopTwoCard || []).push({
          name: names.join(" + ") + " (" + (sbLabels[r[2]] || "infinite loop").toLowerCase() + ")",
          cards: names,
          pieceCosts: names.map((n) => {
            const pc = nameToCard.get(n);
            return pc ? pc.m || 0 : 0;
          }),
        });
        continue;
      } // value loop: Bracket only, never scored
      cand.push({
        r,
        names,
        cmdr,
        rank: (r[1] & 3) * 100 - names.length * 10 + (cmdr ? 5 : 0) + r[3] * 0.5,
      });
    }
    cand.sort((a, b) => b.rank - a.rank);
    agg.spellbookMatched = cand.length;
    // Take the best lines, skipping near-duplicates (same outcome, differing by one card): three ways
    // to reach the same loop are one plan for this deck, not three.
    const chosen: typeof cand = [];
    for (const x of cand) {
      if (chosen.length >= SPELLBOOK_MAX_COMBOS) break;
      const label0 = sbLabels[x.r[2]];
      const dup = chosen.some(
        (c) =>
          sbLabels[c.r[2]] === label0 &&
          x.names.filter((n) => c.names.includes(n)).length >=
            Math.min(x.names.length, c.names.length) - 1,
      );
      if (!dup) chosen.push(x);
    }
    for (const x of chosen) {
      const cls = x.r[1] & 3,
        isInf = (x.r[1] & 4) !== 0,
        label = sbLabels[x.r[2]] || null;
      const combo = { s: x.names.map((n) => [n]), o: label, t: isInf ? "infinite_combo" : "combo" };
      // A game-winning line counts in full; a game-warping one (infinite mana, extra combat phases, a lock)
      // needs a payoff to finish, so it counts for half; long lines (4+ cards) are a little harder to assemble.
      const weight = (cls === 2 ? 1.0 : 0.5) * (x.names.length >= 4 ? 0.85 : 1);
      const pieceCosts = x.names.map((n) => {
        const pc = nameToCard.get(n);
        return pc ? pc.m || 0 : 0;
      });
      agg.detectedCombos.push(describeCombo(combo));
      agg.detectedComboDetails.push({
        cards: x.names,
        outcome: label,
        infinite: isInf,
        bracketRelevant: isInf,
        winsAlone: cls === 2, // house rule: any two-card infinite combo makes a deck Bracket 3 at least; only a game-winning one can push to Bracket 4 on speed
        commanderPiece: x.cmdr,
        redundancy: 0,
        reliability:
          weight + (x.cmdr ? 0.5 : 0) + (tutorSupport + drawSupport + protectionSupport) * weight,
        totalCastCost: pieceCosts.reduce((a, b) => a + b, 0),
        pieceCosts,
        pieceCount: x.names.length,
        source: "spellbook",
        comboClass: cls === 2 ? "win" : "warp",
        matchedNames: x.names,
      });
    }
  }

  // One-card-away combos (display only; never feeds a score).
  agg.comboNear = [];
  try {
    let identStr = "";
    (commanders || []).forEach((n) => {
      const cc = nameToCard.get(n) || resolveCommanderName(ctx, n, matchedCards);
      if (cc) identStr += cc.ci || "";
    });
    agg.comboNear = comboNearMisses(
      ctx,
      namesInDeck,
      commanders || [],
      (commanders || []).length ? new Set(identStr.split("")) : null,
    );
  } catch {
    agg.comboNear = [];
  }

  // Resilience locks are deliberately kept separate from win-condition
  // combo scoring -- a lock makes a board nearly impossible to interact
  // with, but isn't a way to WIN, so it shouldn't feed win-condition
  // detection or Versatility's combo-reliability credit the way a real
  // combo does. It exists purely as a Bracket signal: Wizards' own bracket
  // guidance treats "very hard to answer" board states as a Bracket 4+
  // indicator distinct from MLD, win-combos, or raw Game Changer count,
  // and nothing else in this app currently recognizes that category.
  // Reuses the existing SOFT_SYNERGIES list's "lock" entries rather than a
  // separate curated list, since that schema (and its own detection loop
  // just below) already exists for exactly this purpose.
  agg.detectedLocks = [];

  agg.detectedSynergies = [];
  agg.detectedSynergyDetails = [];
  for (const syn of SOFT_SYNERGIES) {
    if (comboSlotsMatch(namesInDeck, syn)) {
      agg.detectedSynergies.push(describeCombo(syn));
      // Flattened across all slots (including alternatives not actually in
      // this deck) so it lines up with what describeCombo's text itself
      // already shows via " / " -- linkifying exactly what's displayed,
      // not a filtered subset of it.
      agg.detectedSynergyDetails.push({ cards: syn.s.flat() });
      if (syn.t === "lock")
        agg.detectedLocks.push({
          cards: syn.s.map((slot) => slot.join(" / ")),
          outcome: syn.o || null,
        });
    }
  }
}
