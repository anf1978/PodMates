// Key Pieces & Combos: the commander, Game Changers, combos, fast mana, tutors, land denial,
// stax and counter magic, with card pictures for Game Changers and combo pieces only (the other
// lists can run to a dozen cards; their names already open the art when tapped).

import { cardNameLinkHtml } from "../../../ui/card-name.ts";
import { html, nothing, render, trustedHtml } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import type { CardImageMap } from "../../../services/card-art.ts";
import { gameChangerChipsHtml } from "../explainers/card-text.ts";
import { combosSection, type ComboPorts, type CombosAgg } from "./combos-view.ts";

export interface KeyPiecesAgg extends CombosAgg {
  gameChangers: string[];
  fastManaCards: string[];
  tutorCards: string[];
  mldCards: string[];
  staxCards: string[];
  counterCards: string[];
}

export interface KeyPiecesPorts extends ComboPorts {
  fetchImages(names: string[]): Promise<{ urlMap: CardImageMap }>;
}

/** Card-name links joined by `sep`, plus an optional suffix, as one run of escaped markup. */
function links(names: readonly string[], sep: string, suffix = "") {
  // Trusted: cardNameLinkHtml escapes each name; sep and suffix are constants.
  return trustedHtml(names.map(cardNameLinkHtml).join(sep) + suffix);
}

function group(label: string, body: unknown, danger = false): TemplateResult {
  // prettier-ignore
  return html`<div class="kp-group"><strong class=${danger ? "kp-danger" : "kp-gold"}>${label}</strong><br>${body}</div>`;
}

function capped(cards: readonly string[], cap: number) {
  const unique = [...new Set(cards)];
  return links(unique.slice(0, cap), ", ", cards.length > cap ? "…" : "");
}

/** Null when the deck has nothing to show (the panel is then hidden). */
export function keyPiecesTemplate(ports: KeyPiecesPorts, agg: KeyPiecesAgg): TemplateResult | null {
  const sections: TemplateResult[] = [];
  if (agg.commanders && agg.commanders.length)
    sections.push(group("Commander", links(agg.commanders, " / ")));
  if (agg.gameChangers.length) {
    // Trusted: gameChangerChipsHtml escapes every name and attribute.
    const chips = trustedHtml(gameChangerChipsHtml(agg.gameChangers));
    // prettier-ignore
    sections.push(html`<div class="kp-group"><strong class="kp-gold">Game Changers</strong><div id="gameChangerThumbs" class="kp-gc-thumbs"></div>${chips}</div>`);
  }
  const combos = combosSection(ports, agg);
  if (combos) sections.push(combos);
  if (agg.fastManaCards.length)
    sections.push(group("Fast Mana", links([...new Set(agg.fastManaCards)], ", ")));
  if (agg.tutorCards.length)
    sections.push(group("Tutors", links([...new Set(agg.tutorCards)], ", ")));
  if (agg.mldCards.length)
    sections.push(group("Mass Land Denial", links([...new Set(agg.mldCards)], ", "), true));
  if (agg.staxCards.length) sections.push(group("Stax / Tax", capped(agg.staxCards, 12)));
  if (agg.counterCards.length) sections.push(group("Counter Magic", capped(agg.counterCards, 10)));
  if (!sections.length) return null;
  return html`<div class="kp-body">${sections}</div>`;
}

function thumbs(names: readonly string[], urlMap: CardImageMap, combo: boolean) {
  return names.map((name) => {
    const url = urlMap.get(name);
    // No placeholder: the chips and labels right below already name every card.
    if (!url) return nothing;
    return html`<span class="card-name-link kp-thumb" data-card-name=${name}>
      <img
        src=${url}
        alt=${name}
        title=${name}
        loading="lazy"
        class=${combo ? "kp-thumb-img kp-thumb-combo" : "kp-thumb-img kp-thumb-gc"}
      />
    </span>`;
  });
}

/**
 * Fills the picture rows after the text has rendered, so the report shows as fast as before and
 * the art arrives a moment later without moving anything already on screen.
 */
export async function fillKeyPieceThumbs(
  ports: KeyPiecesPorts,
  agg: KeyPiecesAgg,
  area: ParentNode,
): Promise<void> {
  const gcNames = [...new Set(agg.gameChangers || [])];
  const comboCardNames = [
    ...new Set([
      ...(agg.detectedComboDetails || []).flatMap((c) => c.cards || []),
      ...(agg.infiniteLoopTwoCard || []).flatMap((l) => l.cards || []),
    ]),
  ];
  const allNames = [...new Set([...gcNames, ...comboCardNames])];
  if (!allNames.length) return;

  const { urlMap } = await ports.fetchImages(allNames);

  const gcArea = document.getElementById("gameChangerThumbs");
  if (gcArea && gcNames.length) render(thumbs(gcNames, urlMap, false), gcArea);

  area.querySelectorAll<HTMLElement>(".kp-thumbs").forEach((el) => {
    let names: string[] = [];
    try {
      names = JSON.parse(el.getAttribute("data-names") || "[]") as string[];
    } catch {
      names = [];
    }
    render(thumbs(names, urlMap, true), el);
  });
}
