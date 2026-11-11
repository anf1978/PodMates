// The Bracket panel: the official bracket signal, its reasoning, Game Changers, combo counts
// (with the button to Key Pieces), banned cards and the note on how PodMates uses it.

import type { BracketResult } from "../../../engine/brackets.ts";
import type { DeckAnalysis } from "../../../engine/analyze-tallies.ts";
import { cardNameLinkHtml } from "../../../ui/card-name.ts";
import { html, nothing, trustedHtml } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
// The button without its own leading space, so the label before it stays one text node.
import { explainerButton } from "../view.ts";
import { gameChangerChipsHtml } from "../explainers/card-text.ts";

export type BracketAgg = Pick<
  DeckAnalysis,
  | "gameChangers"
  | "detectedCombos"
  | "detectedComboDetails"
  | "comboNear"
  | "infiniteLoopTwoCard"
  | "bannedCards"
>;

function plural(n: number, word: string): string {
  return word + (n === 1 ? "" : "s");
}

function combosLine(agg: BracketAgg): TemplateResult | typeof nothing {
  const loops = agg.infiniteLoopTwoCard || [];
  if (agg.detectedCombos.length > 0) {
    const comboDetails = agg.detectedComboDetails || [];
    const total = agg.detectedCombos.length;
    const nWinC = comboDetails.filter((d) => d.comboClass !== "warp").length;
    const nNearC = (agg.comboNear || []).length;
    const nLoopC = loops.length;
    const counts = ` ${total} ${plural(total, "line")} (${nWinC} ${plural(nWinC, "win")}${total - nWinC ? ", " + (total - nWinC) + " warp" : ""})${nLoopC ? " plus " + nLoopC + " " + plural(nLoopC, "two-card infinite loop") : ""}.`;
    // prettier-ignore
    return html`<div class="detail rs-line"><strong>Combos that win or warp the game:</strong>${counts}<div class="rs-combo-row">    <button type="button" data-go-key-pieces class="rs-combo-btn">${`See each combo and how it works${nNearC ? " · " + nNearC + " one card away" : ""}`}</button></div></div>`;
  }
  if (loops.length) {
    // prettier-ignore
    return html`<div class="detail rs-line"><strong>Two-card infinite loops:</strong>${` ${loops.length}.     `}<button type="button" data-go-key-pieces class="rs-combo-btn">See them</button></div>`;
  }
  return nothing;
}

function joinedLinks(names: readonly string[]) {
  // Trusted: cardNameLinkHtml escapes each name and its data attribute.
  return trustedHtml(names.map((n) => cardNameLinkHtml(n)).join(", "));
}

export function bracketTemplate(bracket: BracketResult, agg: BracketAgg | null): TemplateResult {
  const reasoning = bracket.reasoning.map((r) => (r as string).replace(/\*\*/g, "")).join(" ");
  const cedh = bracket.cedhNote
    ? // prettier-ignore
      html`<div class="detail rs-cedh"><strong class="rs-cedh-head">Could function at a cEDH level.</strong>${` ${bracket.cedhNote}`}</div>`
    : nothing;
  const gc =
    agg && agg.gameChangers.length > 0
      ? // prettier-ignore
        html`<div class="detail rs-gc"><strong>Game Changers found:</strong> ${
          // Trusted: gameChangerChipsHtml escapes every name and attribute.
          trustedHtml(gameChangerChipsHtml(agg.gameChangers))
        }</div>`
      : nothing;
  const banned =
    agg && agg.bannedCards.length > 0
      ? // prettier-ignore
        html`<div class="detail rs-line rs-banned"><strong>Banned cards (left out of the scores):</strong> ${joinedLinks(agg.bannedCards)}</div>`
      : nothing;
  // prettier-ignore
  return html`<div class="bracket-num">${`Bracket ${bracket.bracket} `}${explainerButton("bracket")}</div><div class="reasoning">${reasoning}</div>${cedh}${gc}${agg ? combosLine(agg) : nothing}${banned}${bracket.note ? html`<div class="note">${bracket.note}</div>` : nothing}<div class="detail rs-foot">PodMates uses Command Spark to show how likely a match-up is to be fair. The official bracket signals here are for reference only: they are a rough guide from the cards, not a measure of how evenly two decks will play.</div>`;
}
