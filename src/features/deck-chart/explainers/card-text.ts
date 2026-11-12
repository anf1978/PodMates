// Game Changer chips, their "why is this a Game Changer?" dialog, and linking known card names
// inside already-escaped text. Shared by the chart panels and the explainers.

import { GAME_CHANGER_REASONS } from "../../../data/game-changers.ts";
import { cardNameLinkHtml, escapeHtml } from "../../../ui/card-name.ts";
import { html } from "../../../ui/html.ts";
import { showInfoModal } from "../../../ui/info-modal.ts";

const reasons: Readonly<Record<string, { cat: string; why: string } | undefined>> =
  GAME_CHANGER_REASONS;

/** Chips for the Game Changers; ones with a known reason open it when tapped. Escaped markup. */
export function gameChangerChipsHtml(names: readonly string[]): string {
  const unique = [...new Set(names)];
  return unique
    .map((n) => {
      const hasReason = reasons[n];
      const cls = hasReason ? "gc-chip gc-chip-clickable" : "gc-chip";
      const attr = hasReason ? ` data-gc-card="${escapeHtml(n)}"` : "";
      return `<span class="${cls}"${attr}>${escapeHtml(n)}</span>`;
    })
    .join(" ");
}

export function showCardReason(cardName: string): void {
  const entry = reasons[cardName];
  if (!entry) return;
  showInfoModal(
    // prettier-ignore
    html`<h2 class="ex-title-tight">${cardName}</h2><p class="tad-sub ex-sub-flush">${entry.cat}</p>`,
    html`<div class="ex-reason">${entry.why}</div>`,
  );
}

/**
 * Wraps KNOWN card names inside an already-escaped block of text in card-name links, without
 * guessing at names in free prose. Longest names first, and every name is swapped for an
 * HTML-incapable placeholder before any markup goes in, so a short name can never match text
 * inside a longer name or inside a link already inserted.
 */
export function linkifyKnownCardNames(
  escapedText: string,
  cardNames: readonly string[] | null | undefined,
): string {
  if (!cardNames || !cardNames.length) return escapedText;
  const sorted = [...new Set(cardNames)].sort((a, b) => b.length - a.length);
  let result = escapedText;
  const placeholders: { token: string; name: string }[] = [];
  sorted.forEach((name, i) => {
    const escapedName = escapeHtml(name);
    if (!escapedName || !result.includes(escapedName)) return;
    const token = `\u0000CARDLINK${i}\u0000`;
    result = result.split(escapedName).join(token);
    placeholders.push({ token, name });
  });
  placeholders.forEach(({ token, name }) => {
    result = result.split(token).join(cardNameLinkHtml(name));
  });
  return result;
}
