// "Contributing cards in this deck" under an axis explainer. Returns escaped markup: card names
// are links, every other piece of text goes through escapeHtml.

import { cardNameLinkHtml, escapeHtml } from "../../../ui/card-name.ts";
import { gameChangerChipsHtml } from "./card-text.ts";

export interface ContribAgg {
  fastManaCards: string[];
  rampCards: string[];
  reanimateCards: string[];
  tutorCards: string[];
  protectionCards: string[];
  freeInteractionCards?: string[];
  staxCards: string[];
  counterCards: string[];
  discardCards: string[];
  mldCards: string[];
  gameChangers: string[];
  detectedCombos: string[];
  versatilityFeatures?: number;
  versatilityModes?: number;
  drawCards?: string[];
}

/** A line already rendered as markup, or plain text still to escape. */
type Part = { raw: true; text: string } | string | null;

function line(label: string, cards: readonly string[], cap?: number): Part {
  const unique = [...new Set(cards)];
  if (!unique.length) return null;
  const shown = cap ? unique.slice(0, cap) : unique;
  const suffix = cap && unique.length > cap ? "…" : "";
  return {
    raw: true,
    text: `${escapeHtml(label)}: ${shown.map(cardNameLinkHtml).join(", ")}${suffix}`,
  };
}

export function contributorsFor(
  agg: ContribAgg | null,
  winCons: readonly { label: string }[] | null,
  key: string,
): string {
  if (!agg) return "";
  const lists: Record<string, Part[]> = {
    speed: [
      line("Fast mana", agg.fastManaCards),
      line("Ramp", agg.rampCards, 8),
      line("Reanimate", agg.reanimateCards),
    ],
    consistency: [line("Tutors", agg.tutorCards), line("Protection", agg.protectionCards, 6)],
    disruption: [
      agg.freeInteractionCards ? line("Free interaction", agg.freeInteractionCards) : null,
      line("Stax", agg.staxCards, 6),
      line("Counters", agg.counterCards, 6),
      line("Discard", agg.discardCards),
      line("MLD", agg.mldCards),
    ],
    powerLevel: [
      agg.gameChangers.length
        ? { raw: true, text: `Game Changers: ${gameChangerChipsHtml(agg.gameChangers)}` }
        : null,
      agg.detectedCombos.length ? `Combos: ${agg.detectedCombos.join("; ")}` : null,
      line("Fast mana", agg.fastManaCards),
      line("Tutors", agg.tutorCards),
    ],
    versatility: [
      winCons && winCons.length
        ? `Detected win condition(s): ${winCons.map((w) => w.label).join(", ")}`
        : null,
      `Distinct functional capabilities: ${agg.versatilityFeatures || 0} · Modal/flexible cards: ${agg.versatilityModes || 0}`,
      agg.drawCards ? line("Card draw", agg.drawCards, 8) : null,
      agg.rampCards ? line("Ramp", agg.rampCards, 8) : null,
    ],
  };
  const parts = (lists[key] || []).filter((p): p is Exclude<Part, null> => Boolean(p));
  if (!parts.length) return "";
  const rendered = parts.map((p) => (typeof p === "string" ? escapeHtml(p) : p.text));
  return `<div class="ex-contrib"><strong>Contributing cards in this deck:</strong><br>${rendered.join("<br>")}</div>`;
}
