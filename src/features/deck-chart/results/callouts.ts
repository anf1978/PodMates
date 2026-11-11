// The three callouts above the radar: Win Condition, Closest Match and Table Vibe (with Deck
// Craft). Text runs are kept to one interpolation each, as the old string builders produced.

import type { WinCondition } from "../../../engine/types.ts";
import type { TableFeel } from "../../../engine/table-feel.ts";
import type { SpiritBand } from "../../../engine/spark.ts";
import type { ArchetypeMatch } from "../../../engine/benchmarks.ts";
import type { SampleDeck } from "../../../services/reference-data.ts";
import { cardNameLink, escapeHtml } from "../../../ui/card-name.ts";
import { html, nothing, trustedHtml } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
// The button without its own leading space, so the label before it stays one text node.
import { explainerButton } from "../view.ts";
import { linkifyKnownCardNames } from "../explainers/card-text.ts";

function confidenceLabel(w: WinCondition): string {
  return w.confidence === "fallback" ? "best guess" : w.confidence + " confidence";
}

function linkedDetail(w: WinCondition) {
  // Trusted: the detail is escaped first; linkifyKnownCardNames only adds escaped name links.
  return trustedHtml(linkifyKnownCardNames(escapeHtml(w.detail), w.cards));
}

export function winConditionTemplate(winCons: readonly WinCondition[]): TemplateResult {
  const primary = winCons[0] as WinCondition;
  const others = winCons.slice(1);
  const also = others.length
    ? // prettier-ignore
      html`<div class="rs-also"><div class="rs-also-head">${`Also detected (${others.length})`}</div>${others.map(
        (w) =>
          // prettier-ignore
          html`<div class="rs-wc-item"><strong class="rs-gold">${w.label}</strong><span class=${`confidence-tag confidence-${w.confidence} rs-tag-gap`}>${confidenceLabel(w)}</span><div class="detail rs-wc-detail">${linkedDetail(w)}</div></div>`,
      )}</div>`
    : nothing;
  // prettier-ignore
  return html`<div class="label">Win Condition ${explainerButton("winCondition")}</div><div class="value">${primary.label}<span class=${`confidence-tag confidence-${primary.confidence}`}>${confidenceLabel(primary)}</span></div><div class="detail">${linkedDetail(primary)}</div>${also}`;
}

export function archetypeMatchTemplate(match: ArchetypeMatch<SampleDeck> | null): TemplateResult {
  if (!match) {
    // prettier-ignore
    return html`<div class="label">Closest Match</div><div class="value">No strong signal</div><div class="detail">This deck doesn't lean hard enough on any single detected theme or mechanic to call a confident match against the precon corpus.</div>`;
  }
  const { top, runnersUp } = match;
  const pct = Math.round(top.sim * 100);
  const where = `)${top.deck.source === "precon" ? ", " + top.deck.setName : ""}.`;
  const also = runnersUp.length
    ? // prettier-ignore
      html`<div class="rs-also"><div class="rs-also-head">Also similar to</div>${runnersUp.map(
        (r) =>
          // prettier-ignore
          html`<div class="rs-am-item"><strong class="rs-primary">${r.deck.archetype}</strong><span class="rs-soft">${` — ${r.deck.flavorName} (${Math.round(r.sim * 100)}%)`}</span></div>`,
      )}</div>`
    : nothing;
  // prettier-ignore
  return html`<div class="label">Closest Match ${explainerButton("archetypeMatch")}</div><div class="value">${top.deck.archetype}<span class="confidence-tag confidence-medium">${`${pct}% overlap`}</span></div><div class="detail">Closest to <strong class="rs-gold">${top.deck.flavorName}</strong> (${cardNameLink(top.deck.commander)}${where}</div>${also}`;
}

function forThisDeck(why: string | undefined) {
  // prettier-ignore
  return why ? html`<br><br><em>For this deck:</em>${` ${why}`}` : nothing;
}

export function tableFeelTemplate(
  tableFeel: TableFeel,
  deckCraft: SpiritBand | null | undefined,
): TemplateResult {
  const craft = deckCraft
    ? // prettier-ignore
      html`<div class="rs-craft"><div class="label">Deck Craft</div><div class="value">${deckCraft.band}</div><div class="detail">${deckCraft.detail}</div></div>`
    : nothing;
  const craftHow = deckCraft
    ? // prettier-ignore
      html`<br><br><strong class="rs-primary">Deck Craft</strong> measures how much time and attention went into the 99, using seven signals: 5+ tutors, 3+ fast mana sources, an engine ratio of 18%+, 2+ free interaction spells, 12+ card draw sources, 8+ stax effects, and any Game Changer — plus overall Command Spark as a cross-check when the individual counts stay under threshold.${forThisDeck(deckCraft.why)}`
    : nothing;
  // prettier-ignore
  return html`<div class="label">Table Vibe <span class="rs-estimate">(estimate)</span></div><div class="value">${tableFeel.label}</div><div class="detail">${tableFeel.you}</div><div class="detail rs-pod"><strong>Your pod:</strong>${` ${tableFeel.pod}`}</div>${craft}<details class="rs-how"><summary>How did we build this?</summary><div class="rs-how-body"><strong class="rs-primary">Table Vibe</strong> maps your deck's primary win condition onto the classic Timmy/Johnny/Spike player psychographics (Mark Rosewater's framework for what motivates a player to play — Timmy: big, memorable plays; Johnny: winning on your own terms; Spike: playing to win). Heavy stax gets its own callout — Rosewater has confirmed "griefer" is technically a Timmy subtype. Very low-power decks with no real synergy plan get "Blorbo" instead, an unofficial community term for playing because you like your commander, not because you're trying to win.${forThisDeck(tableFeel.why)}${craftHow}</div></details>`;
}
