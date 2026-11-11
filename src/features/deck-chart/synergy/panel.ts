// The Synergy panel: top themes, headline stats, key interactions read from card text (with the
// "Cards you could add" button), cards that depend on creatures, unread cards, strongest pairs,
// known pairs, the staples check, engine cards and the interaction mix. Display only.

import type { DeckAnalysis } from "../../../engine/analyze-tallies.ts";
import type { MatchedCard } from "../../../cards/lookup.ts";
import { cardNameLinkHtml } from "../../../ui/card-name.ts";
import { html, nothing, trustedHtml } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { ixDescribePackage, ixThinSpots, setSuggestionContext } from "../interactions/index.ts";
import type { InteractionReading, SuggestionContext } from "../interactions/index.ts";
import {
  engineChips,
  knownPairs,
  nameLinks,
  staplesCheck,
  strongestPairs,
  themeChips,
  type StaplesResult,
} from "./sections.ts";
import { HOW_BUILT, TIPS } from "./copy.ts";

export type SynergyAgg = Pick<
  DeckAnalysis,
  | "topThemes"
  | "engineRatio"
  | "earlyDensity"
  | "commanderAlignment"
  | "freeInteraction"
  | "cheapInteraction"
  | "expensiveInteraction"
  | "synergyEdges"
  | "synergyEngineCards"
  | "detectedSynergies"
  | "detectedSynergyDetails"
  | "synergyTopClusterSize"
  | "freeInteractionCards"
  | "ramp"
  | "draw"
  | "removal"
>;

export interface SynergyPorts {
  packages(matched: MatchedCard[], commanders: string[]): InteractionReading;
  staples(agg: SynergyAgg, archetype: string): StaplesResult;
}

export interface ArchetypeMatchLike {
  top?: { deck: { archetype: string } } | null;
}

const head = (title: string, tip: string, extraClass = "") =>
  html`<div class=${"syn-h syn-h-help" + extraClass} title=${tip}>${title}</div>`;

function interactionBlocks(reading: InteractionReading | null, ctx: SuggestionContext | null) {
  if (!reading || !ctx) return { pk: nothing, cond: nothing, idle: nothing };
  const thin = ixThinSpots(ctx.roles);
  const thinText = thin.length
    ? "Thin spots: " +
      thin.map((x) => x.label.toLowerCase() + " (" + x.have + " of " + x.floor + "+)").join(", ")
    : "";
  // Trusted: ixDescribePackage escapes all card text and links names with cardNameLinkHtml.
  const described = trustedHtml(
    reading.packages.map((pk) => ixDescribePackage(pk, cardNameLinkHtml)).join(""),
  );
  // prettier-ignore
  const pk = html`<div class="syn-block">
      ${head("Key Interactions", TIPS.keyInteractions)}
      ${described}
      <div class="syn-add-row">      <button type="button" data-show-ix-suggestions class="syn-add-btn">Cards you could add ›</button>${thinText ? html`<div class="syn-thin">${thinText}</div>` : nothing}</div>
      <div class="syn-small-note">Pilot: these are the things to find. Opponent: these are what to be wary of or answer first. Builder: cards that feed or repeat them are worth keeping.</div>
    </div>`;
  const cond =
    reading.conditional && reading.conditional.length
      ? // prettier-ignore
        html`<div class="syn-block">
      <div class="syn-h syn-h-6">Cards That Depend On Your Creatures</div>
      ${reading.conditional.map((c) => html`<div class="syn-cond">${nameLinks([c.name])} <span class="syn-cond-why">${"– " + c.why + "."}</span></div>`)}
    </div>`
      : nothing;
  const idle =
    reading.idle && reading.idle.length
      ? // prettier-ignore
        html`<div class="syn-block">
      <div class="syn-h syn-h-6">Not Understood Yet</div>
      <div>${reading.idle.slice(0, 12).map((n, i) => html`${i ? " " : ""}<span class="gc-chip">${nameLinks([n])}</span>`)}</div>
      <div class="syn-idle-note">This reading found no link to the plan or commander and no everyday job such as ramp, draw or removal. That means the reading may be missing something, not that the card is weak; check each one before judging it.</div>
    </div>`
      : nothing;
  return { pk, cond, idle };
}

export function synergyTemplate(
  ports: SynergyPorts,
  agg: SynergyAgg,
  archetypeMatch: ArchetypeMatchLike | null | undefined,
  matched: MatchedCard[] | null | undefined,
  commanders: string[] | null | undefined,
): TemplateResult {
  const themes = themeChips(agg.topThemes || []);
  const pct = (v: number | undefined) => ((v || 0) * 100).toFixed(0) + "%";
  const ix = `Free ${agg.freeInteraction || 0} · Cheap ${agg.cheapInteraction || 0} · Expensive ${agg.expensiveInteraction || 0}`;

  let staples: TemplateResult | typeof nothing = nothing;
  if (archetypeMatch && archetypeMatch.top) {
    const archetype = archetypeMatch.top.deck.archetype;
    const result = ports.staples(agg, archetype);
    if (result.baseline) staples = staplesCheck(archetype, result);
  }

  let reading: InteractionReading | null = null;
  try {
    if (matched && matched.length) reading = ports.packages(matched, commanders || []);
  } catch {
    reading = null;
  }
  const hasPk = !!(reading && reading.packages && reading.packages.length);
  const ctx: SuggestionContext | null =
    hasPk && reading && matched
      ? {
          matched,
          commanders: commanders || [],
          packages: reading.packages,
          axis: reading.axis,
          roles: { ramp: agg && agg.ramp, draw: agg && agg.draw, removal: agg && agg.removal },
        }
      : null;
  setSuggestionContext(ctx);
  const { pk, cond, idle } = interactionBlocks(hasPk ? reading : null, ctx);
  const more = (inner: TemplateResult) =>
    hasPk
      ? // prettier-ignore
        html`<details class="syn-more"><summary class="syn-more-summary">More card links and engine cards</summary>${inner}</details>`
      : inner;
  const engine = engineChips(agg.synergyEngineCards || [], agg.synergyEdges || []);
  const free =
    agg.freeInteractionCards && agg.freeInteractionCards.length
      ? html`<br /><span class="syn-free"
            >Free: ${nameLinks([...new Set(agg.freeInteractionCards)])}</span
          >`
      : nothing;

  // Trusted: constant help text written in this repo (only <em> and <br>).
  const howBuilt = trustedHtml(HOW_BUILT);
  // prettier-ignore
  return html`
    <div class="syn-block-12">
      ${head("Top Themes", TIPS.topThemes, " syn-h-6")}
      <div>${themes.length ? themes : html`<span class="syn-soft">No strong theme concentration detected.</span>`}</div>
    </div>
    <div class="syn-stats">
      <div class="stat"><span class="num">${pct(agg.engineRatio)}</span><span class="lbl syn-help" title="Percent of nonland cards that provide repeatable value or 2+ meaningful interactions on their own.">Engine density</span></div>
      <div class="stat"><span class="num">${pct(agg.earlyDensity)}</span><span class="lbl syn-help" title="Percent of nonland cards with a mana value of 2 or less.">Early spells (≤2)</span></div>
      <div class="stat"><span class="num">${String(agg.synergyTopClusterSize || 0)}</span><span class="lbl syn-help" title="The largest group of cards all connected to each other via a detected interaction — how much of the deck reads as one interlocking machine versus separately-good cards.">Top cluster size</span></div>
      <div class="stat"><span class="num">${pct(agg.commanderAlignment)}</span><span class="lbl syn-help" title="Percent of cards that specifically support your commander's own signals or themes.">Commander-aligned</span></div>
    </div>
    ${pk}${cond}${idle}
    ${more(html`<div class="syn-block">
      ${head("Strongest Interactions", TIPS.strongest)}
      ${strongestPairs(agg.synergyEdges || [])}
    </div>`)}
    ${knownPairs(agg.detectedSynergies, agg.detectedSynergyDetails)}
    ${staples}
    ${engine ? more(html`<div class="syn-block">
      <div class="syn-h syn-h-6 syn-h-help" title=${TIPS.engine}>Engine Cards <span class="syn-h-note">(repeatable value or 2+ meaningful interactions)</span></div>
      <div>${engine.chips}</div>
      ${engine.legend}
    </div>`) : ""}
    <div class="syn-mix">
      <strong class="syn-gold syn-help" title=${TIPS.mix}>Interaction mix:</strong>${" " + ix + " "}${free}
    </div>
    <details class="dc-how">
      <summary class="dc-how-summary">How was this built?</summary>
      <div class="dc-how-body">${howBuilt}</div>
    </details>
  `;
}
