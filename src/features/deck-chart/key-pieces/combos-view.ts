// The Combos section of Key Pieces & Combos: every detected line with its result, how it works,
// the cards and the bracket effect, then two-card loops and one-card-away lines. Display only.
// Card pictures are filled into each `.kp-thumbs` box afterwards (see key-pieces.ts).

import { earliestComboTurn } from "../../../engine/brackets.ts";
import { comboDisplayWin } from "../../../engine/combo-outcomes.ts";
import type { ManaCurvePoint, NearMissGroup, TwoCardLoop } from "../../../engine/types.ts";
import { cardNameLink } from "../../../ui/card-name.ts";
import { html, nothing } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { comboStepsFor } from "./combo-steps.ts";
import {
  comboBracketLine,
  comboHow,
  comboMergedItems,
  comboNiceOutcome,
  type ComboAgg,
  type ComboRow,
} from "./combo-text.ts";

export interface CombosAgg extends ComboAgg {
  commanders?: string[];
  infiniteLoopTwoCard?: TwoCardLoop[];
  comboNear?: NearMissGroup[];
  spellbookMatched?: number;
}

/** What the section reads from the page besides the analysis. */
export interface ComboPorts {
  /** Type line and mana value of a combo piece, or null when the card is unknown. */
  comboCard(name: string): { t?: string; m?: number } | null;
  /** The Spellbook snapshot date, when the snapshot loaded. */
  spellbookDate(): string | null | undefined;
  /** The deck's mana curve, or null when it cannot be computed. */
  manaCurve(): readonly ManaCurvePoint[] | null;
}

type TagKind = "win" | "warp" | "plain";

function comboTag(text: string, kind: TagKind): TemplateResult {
  // prettier-ignore
  return html`<span data-contrast-review=${kind === "warp" ? "combo-warp" : nothing} class=${"kp-tag kp-tag-" + kind}>${text}</span>`;
}

function comboChips(
  names: readonly string[],
  cmdrs: readonly string[],
  missing?: string,
): TemplateResult[] {
  const chip = (n: string, miss: boolean) =>
    // prettier-ignore
    html`<span class=${miss ? "kp-chip kp-chip-miss" : "kp-chip kp-chip-have"}>${miss ? html`<span class="kp-plus">+ </span>` : nothing}${cardNameLink(n)}${cmdrs.includes(n) ? html` <span class="kp-star" title="Your commander">★</span>` : nothing}</span>`;
  return names.map((n) => chip(n, false)).concat(missing ? [chip(missing, true)] : []);
}

/** Facts only: type line and mana value, read from the card data. */
function comboRole(ports: ComboPorts, name: string, isCmdr: boolean): string {
  const c = ports.comboCard(name);
  const bits: string[] = [];
  if (isCmdr) bits.push("Your commander");
  if (c) {
    if (c.t) bits.push(c.t);
    bits.push("MV " + (c.m || 0));
  }
  return bits.join(" · ");
}

function comboDetailsBlock(
  ports: ComboPorts,
  cards: readonly string[],
  outcome: string | null | undefined,
  win: boolean,
  cmdrs: readonly string[],
  extra: TemplateResult | typeof nothing,
): TemplateResult {
  const steps = comboStepsFor(cards);
  // prettier-ignore
  const roles = cards.map((n) => html`<div class="kp-role">${cardNameLink(n)} <span class="kp-soft">${"– " + comboRole(ports, n, cmdrs.includes(n))}</span></div>`);
  // prettier-ignore
  return html`<div class="kp-how">
    <div class="kp-how-label">How it works</div>
    <div class="kp-how-text">${steps || comboHow(outcome, win)}</div>
    ${steps ? "" : html`<div class="kp-how-general">General description for this kind of line. Read each card for exact costs and timing.</div>`}
    <div class="kp-how-label kp-how-cards">The cards</div>${roles}${extra}</div>`;
}

function comboBlock(
  ports: ComboPorts,
  d: ComboRow,
  text: string | undefined,
  turn: number | null,
  agg: CombosAgg,
): TemplateResult {
  const cards = d.matchedNames && d.matchedNames.length ? d.matchedNames : d.cards;
  const cmdrs = cards.filter((n) => (agg.commanders || []).includes(n));
  const win = d.comboClass !== "warp";
  const outcome = d.outcome || (String(text).match(/\(([^)]*)\)\s*$/) || [])[1] || null;
  const extra = turn
    ? html`<div class="kp-turn">
        ${`If you drew them all, the pieces could be out by about turn ${turn}.`}
      </div>`
    : nothing;
  // prettier-ignore
  return html`<div class=${win ? "kp-combo kp-combo-win" : "kp-combo kp-combo-warp"}>
    <div>${comboTag(win ? "Wins" : "Warps", win ? "win" : "warp")}${comboTag(cards.length + " cards", "plain")}${d.infinite ? comboTag("Infinite", "plain") : nothing}</div>
    <div class="kp-thumbs" data-names=${JSON.stringify(cards)}></div>
    <div class="kp-result"><span class="kp-soft">Result:</span> <strong>${comboNiceOutcome(outcome)}</strong></div>
    ${comboDetailsBlock(ports, cards, outcome, win, cmdrs, extra)}
    <div class="kp-bracket">${comboBracketLine(d, turn)}</div>
  </div>`;
}

function loopBlock(l: TwoCardLoop, commanders: readonly string[]): TemplateResult {
  const what = l.name
    .replace(/^.*? \+ .*? \(/, "")
    .replace(/\)$/, "")
    .replace(/^./, (c) => c.toUpperCase());
  // prettier-ignore
  return html`<div class="kp-combo kp-combo-loop">
    <div>${comboTag("Loop", "plain")}${comboTag("2 cards", "plain")}${comboTag("Infinite", "plain")}</div>
    <div class="kp-thumbs" data-names=${JSON.stringify(l.cards)}></div>
    <div class="kp-loop-chips">${comboChips(l.cards, commanders)}</div>
    <div class="kp-loop-what">${what} <span class="kp-soft">(a loop that wins nothing by itself)</span></div>
    <div class="kp-bracket">Bracket effect: any two-card infinite combo makes a deck Bracket 3 at least. A loop with no win of its own never pushes to Bracket 4. It is not scored.</div>
  </div>`;
}

function nearGroups(ports: ComboPorts, near: NearMissGroup[], agg: CombosAgg): TemplateResult[] {
  const cmdrs = agg.commanders || [];
  return near.map((g) => {
    const meta = `MV ${g.mv} · completes ${g.count} line${g.count === 1 ? "" : "s"}`;
    const lines = g.lines.map((l) => {
      const win = comboDisplayWin(l.outcome, l.win);
      const held = cmdrs.filter((n) => l.held.includes(n));
      // prettier-ignore
      return html`<details class="kp-near-line"><summary class="kp-near-summary">
          <div>${comboTag(win ? "Wins" : "Warps", win ? "win" : "warp")}${l.inf ? comboTag("Infinite", "plain") : nothing}</div>
          <div class="kp-near-chips">${comboChips(l.held, cmdrs, g.missing)}</div>
          <div class="kp-near-result"><span class="kp-soft">Result:</span> <strong>${comboNiceOutcome(l.outcome)}</strong> <span class="kp-soft kp-small">· how it works</span></div>
        </summary>${comboDetailsBlock(ports, l.held.concat([g.missing]), l.outcome, win, held, nothing)}</details>`;
    });
    // prettier-ignore
    return html`<div class="kp-near">
      <div class="kp-near-head"><span class="kp-plus">+ </span><strong>${cardNameLink(g.missing)}</strong> <span class="kp-soft kp-small">${meta}</span></div>
      ${lines}
    </div>`;
  });
}

const sub = (txt: string) => html`<div class="kp-sub">${txt}</div>`;

/** The whole Combos section, or null when the deck has no combo, loop or near miss. */
export function combosSection(ports: ComboPorts, agg: CombosAgg): TemplateResult | null {
  const items = comboMergedItems(agg),
    loops = agg.infiniteLoopTwoCard || [];
  const near = agg.comboNear || [];
  if (!items.length && !loops.length && !near.length) return null;
  let curve: readonly ManaCurvePoint[] | null = null;
  try {
    curve = ports.manaCurve();
  } catch {
    curve = null;
  }
  const nWin = items.filter((x) => x.d.comboClass !== "warp").length,
    nWarp = items.length - nWin;
  const sbShown = (agg.detectedComboDetails || []).filter((d) => d.source === "spellbook").length;
  const sbMore = (agg.spellbookMatched || 0) - sbShown;
  const counts =
    (items.length
      ? nWin +
        " win" +
        (nWin === 1 ? "" : "s") +
        (nWarp ? ", " + nWarp + " warp" + (nWarp === 1 ? "" : "s") : "")
      : "none that win or warp") +
    (loops.length ? " · " + loops.length + " two-card loop" + (loops.length === 1 ? "" : "s") : "");
  const date = ports.spellbookDate();
  const footer =
    "From PodMates’ own combo list plus a built-in copy of Commander Spellbook" +
    (date ? " (snapshot of " + String(date).slice(0, 10) + ")" : "") +
    ". Lines that win the game or warp it are listed (infinite damage or mana, extra turns, locks), plus two-card infinite loops for the bracket. A line that just adds cards to a smaller combo is not listed again." +
    (sbMore > 0
      ? ` ${sbMore} more line${sbMore === 1 ? "" : "s"} also match${sbMore === 1 ? "es" : ""} this deck but only the ${sbShown} strongest Spellbook line${sbShown === 1 ? " is" : "s are"} scored, so a pile of overlapping combos cannot run away with the numbers.`
      : "");
  const blocks = items.map((x) => {
    let turn: number | null = null;
    try {
      turn = curve ? earliestComboTurn(x.d, curve) : null;
    } catch {
      turn = null;
    }
    return comboBlock(ports, x.d, x.text, turn, agg);
  });
  // prettier-ignore
  return html`<div class="kp-section"><strong class="kp-gold">Combos</strong> <span class="kp-soft kp-count">${counts}</span>
    <div class="kp-legend">${comboTag("Wins", "win")} finishes the game on its own. ${comboTag("Warps", "warp")} breaks the game open but needs a payoff. ${comboTag("Loop", "plain")} repeats forever but wins nothing alone. Tap any card picture to enlarge it.</div>${blocks}${loops.length ? html`${sub("Two-card infinite loops")}${loops.map((l) => loopBlock(l, agg.commanders || []))}` : nothing}${near.length ? html`${sub("One card away")}<div class="kp-near-intro">Add one card and a combo is complete. Inside your commander’s colours and legal to play.</div>${nearGroups(ports, near, agg)}` : nothing}<div class="kp-footer">${footer}</div></div>`;
}
