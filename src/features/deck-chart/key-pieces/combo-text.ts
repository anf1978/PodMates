// Plain-English text for a combo line: the general "how it works" template by outcome, the
// bracket line and the merge of curated + Spellbook rows. Display only; no scoring here.

import { EARLY_COMBO_BY_TURN } from "../../../engine/brackets.ts";
import {
  COMBO_FINISH,
  COMBO_NEEDS_PAYOFF,
  comboDisplayWin,
  comboKind,
} from "../../../engine/combo-outcomes.ts";
import type { ComboDetail } from "../../../engine/types.ts";

// prettier-ignore
export function comboHow(outcome: string | null | undefined, win: boolean): string {
  const o = String(outcome || '').toLowerCase();
  const k = comboKind(outcome);
  const near = /near-infinite/.test(o);
  let t = '';
  switch (k) {
    case 'mana': {
      if (/for opponents|for all players|for each opponent/.test(o)) { t = "The mana this makes goes to your opponents, or to every player, not only you. Check who gains from it before you start."; break; }
      t = "Every trip round this loop makes more mana than it costs, so you can repeat it as often as you like. Keep the surplus for a payoff: a mana sink, a big draw spell, or damage to finish the game.";
      if (/only be spent|only be used|can't be spent|if you control|if your opponent|during |only/.test(o.replace(/^infinite /, ''))) t += " The mana has a limit on what it can pay for or when you can use it (read the result above), so make sure you have somewhere to spend it.";
      break; }
    case 'draw': t = "The loop draws you cards without limit. It only ever draws for you, so it cannot make an opponent draw their library. Stop before your own library runs out unless you win with an empty library (Thassa's Oracle, Laboratory Maniac), or spend the cards on something: a big spell with the mana, or damage that scales with cards drawn."; break;
    case 'turns': t = "The pieces let you take another turn again and again. Extra turns only help if they are yours: stop when you have what you need, or pair it with a way to win during those turns." + (/after one turn cycle/.test(o) ? " It takes a full turn cycle to get going, so the pieces have to survive until then." : ""); break;
    case 'combatphases': t = "The loop gives you extra combat phases without limit, so a creature that can attack and deal damage (haste helps) attacks again and again. You still need something that actually deals the damage."; break;
    case 'combatdmg': t = "Combat damage repeats without limit. Attack the player you want out."; break;
    case 'dmg':
      t = near ? "Each pass round the loop deals a huge amount of damage or life loss, far more than any life total (not endless, but enough to end the game). Point it at the opponents until they are out."
               : "Each pass round the loop deals damage or drains life, with no limit on how often it repeats. Point it at the opponents until they are out.";
      if (/all players|each player/.test(o)) t = "Every pass hits every player, you included. Only start it if you can survive it (life gain, damage prevention) or if it ends the game before it matters.";
      break;
    case 'dmgcreatures': t = "Each pass deals damage to creatures without limit, which clears the board" + (/all creatures/.test(o) ? " (yours too)" : "") + ". It does not hurt players on its own."; break;
    case 'killplayer':
      t = "The loop ends with a player losing the game outright." + (/each opponent/.test(o) ? " It hits every opponent." : /target (?:opponent|player)/.test(o) ? " Choose the opponent you want out." : "");
      if (/beginning of their next|next upkeep|next end step/.test(o)) t += " The loss comes later, at the start of their next step, so they get to act until then.";
      if (/on each of your turns/.test(o)) t += " It repeats on each of your turns, so the target is locked out of the game.";
      t += " Opponents can still respond, so check what they could do first."; break;
    case 'win': t = "These cards win the game outright once they resolve. Read the exact trigger and check what an opponent could do in response."; break;
    case 'winlater': t = "These cards set up a win at the beginning of your next upkeep. You have to survive until then and keep the pieces on the table, so it gives opponents a full turn to respond."; break;
    case 'oppmill': t = "The line empties an opponent's library. Aim it at the player you want out: they lose the next time they would draw a card. Other players can still respond, so check what they can do before you go."; break;
    case 'oppexileplay': t = "The line exiles every opponent's library, so each of them loses the next time they would draw. The exiled cards can be played by you, which can be a payoff in itself."; break;
    case 'milleveryone': t = "This empties every library, yours included. Whoever has to draw next loses, so only start it when you will not be the one drawing first, or when you can win before then."; break;
    case 'ownlib': t = "This exiles your own library. It does nothing to opponents, and on its own it makes you lose at your next draw. It is a setup for an empty-library win (Thassa's Oracle, Laboratory Maniac) or for cards that use the exiled cards."; break;
    case 'selfmill': t = "This mills your own library without limit. It fills your graveyard for payoffs that use it, and it brings you closer to decking. Stop before the library runs out unless you win with an empty library."; break;
    case 'castlib': t = "This casts every spell in your library, so the library ends up empty. Everything resolves in one go. Line up the win first (or an empty-library win), because you lose at your next draw otherwise."; break;
    case 'putcreatures': t = "This puts every creature card from your library onto the battlefield" + (/tapped/.test(o) ? " tapped" : "") + ", and all their enter triggers go off together. The payoff is whatever those creatures do, so check that none of them hurts you."; break;
    case 'oppsaclock': t = "Opponents sacrifice any creature as soon as it enters under their control, so they cannot build a board. It is a lock rather than a kill."; break;
    case 'oppwipe': t = /permanents/.test(o) ? "Each opponent loses all their permanents. Your own board stays, so it clears the way for an attack." : "Opponents' creatures are removed in one go. Your own creatures stay, so it clears the way for an attack."; break;
    case 'allwipe': t = "This destroys every creature, yours included. It clears the board but leaves you without a team unless you can protect yours or rebuild."; break;
    case 'landdenial': t = "This wipes out lands or stops them working. Unless the cards say otherwise it hits every player, you included, so use it when you are ahead on board. It wins slowly rather than at once."; break;
    case 'discard': t = "Each pass forces a discard, so the target's hand is emptied."; break;
    case 'pwact': t = "You can activate planeswalker abilities again and again, so their loyalty and effects stack up as many times as you like."; break;
    case 'removal': t = "Each pass removes a creature, so you can clear a board one creature at a time without limit."; break;
    case 'mill': t = "The line mills a library without limit. Check whose library it hits: your own needs a stop before you deck yourself, an opponent's is the target to aim for."; break;
    case 'lock': t = "Together these pieces stop opponents from doing something important, and it is hard to undo once it is set up."; break;
    case 'large': t = /creatures/.test(o) ? "Your creatures grow without limit this turn. Any attacker that connects (or tramples over a blocker) is lethal, and the creatures need protecting from removal." : "One creature grows without limit this turn. It wins through any blockers if it has evasion or trample, and it needs protecting from removal."; break;
    case 'life': t = "You can gain or lose life without limit. On its own that does not kill: pair it with something that turns life into damage, or use it to stay alive."; break;
    case 'tokens': t = "Each pass makes another creature or token (or removes one). The kill comes from using them: haste, a sacrifice outlet with a drain, or a mass pump."; break;
    case 'etb': t = "The loop repeats an enter-the-battlefield, untap or death trigger over and over, so whatever that trigger does happens as many times as you want."; break;
    default: t = "These cards combine into a repeatable effect, described by the result above.";
  }
  let end: string;
  if (COMBO_FINISH[k]) end = k === 'winlater' ? '' : " This line can finish the game by itself.";
  else if (COMBO_NEEDS_PAYOFF[k]) end = (k === 'ownlib' || k === 'selfmill' || k === 'castlib' || k === 'putcreatures' || k === 'allwipe' || k === 'landdenial') ? '' : " This line breaks the game open but usually needs a payoff to finish.";
  else end = win ? " This line can finish the game by itself." : " This line breaks the game open but usually needs a payoff to finish.";
  return t + end;
}

export function comboNiceOutcome(o: string | null | undefined): string {
  const s = String(o || "combo effect").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type ComboRow = Pick<
  ComboDetail,
  | "cards"
  | "outcome"
  | "infinite"
  | "bracketRelevant"
  | "winsAlone"
  | "pieceCount"
  | "matchedNames"
  | "comboClass"
  | "totalCastCost"
  | "pieceCosts"
  | "source"
>;

export interface ComboItem {
  d: ComboRow;
  text: string | undefined;
}

export interface ComboAgg {
  detectedComboDetails?: ComboRow[];
  detectedCombos?: string[];
}

/** Rows naming the same cards are merged (outcomes joined), wins first, then fewest pieces. */
export function comboMergedItems(agg: ComboAgg): ComboItem[] {
  const details = agg.detectedComboDetails || [],
    texts = agg.detectedCombos || [];
  const merged = new Map<string, ComboItem>();
  details.forEach((d, i) => {
    const cs = d.matchedNames && d.matchedNames.length ? d.matchedNames : d.cards;
    const key = cs.slice().sort().join("|");
    const o = merged.get(key);
    if (!o) merged.set(key, { d: Object.assign({}, d), text: texts[i] });
    else if (d.outcome && o.d.outcome && !o.d.outcome.includes(d.outcome))
      o.d.outcome = o.d.outcome + " and " + d.outcome;
  });
  merged.forEach((v) => {
    v.d.comboClass = comboDisplayWin(v.d.outcome, v.d.comboClass !== "warp") ? "win" : "warp";
  });
  return Array.from(merged.values()).sort(
    (a, b) =>
      Number(b.d.comboClass !== "warp") - Number(a.d.comboClass !== "warp") ||
      (a.d.pieceCount || a.d.cards.length) - (b.d.pieceCount || b.d.cards.length),
  );
}

/** One line on what this combo does to the bracket: mirrors detectBracketCore exactly. */
export function comboBracketLine(
  d: Pick<ComboRow, "pieceCount" | "cards" | "bracketRelevant" | "winsAlone">,
  turn: number | null | undefined,
): string {
  const n = d.pieceCount || (d.cards || []).length;
  if (n >= 3)
    return "Bracket effect: none. Combos of three or more cards do not change the bracket.";
  if (n === 2 && d.bracketRelevant !== false) {
    if (d.winsAlone !== false && turn !== null && turn !== undefined && turn <= EARLY_COMBO_BY_TURN)
      return `Bracket effect: a two-card infinite combo that wins on its own and could be out by about turn ${turn}. This pushes the deck to Bracket 4.`;
    return (
      "Bracket effect: any two-card infinite combo makes a deck Bracket 3 at least. " +
      (d.winsAlone === false
        ? "This one needs a payoff to win, so it never pushes to Bracket 4 on speed."
        : "It is too slow to push the deck to Bracket 4.")
    );
  }
  return "Bracket effect: none.";
}
