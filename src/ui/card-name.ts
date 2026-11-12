// A card name that opens the card's art when tapped. Used wherever a card is named as plain
// text with no thumbnail beside it, so it is a UI primitive rather than one feature's markup.
// The click itself is handled by the page's delegated [data-card-name] listener.

import { trustedHtml } from "./html.ts";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for the string-built markup that `trustedHtml()` inserts. */
export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** The clickable name as markup, for string-built panels. */
export function cardNameLinkHtml(name: string): string {
  return `<span translate="no" class="card-name-link" data-card-name="${escapeHtml(name)}">${escapeHtml(name)}</span>`;
}

/**
 * The same link for lit-html callers. Returns raw markup rather than a template so a run of
 * names joined by ", " stays one text node, matching the legacy string templates' layout.
 */
export function cardNameLink(name: string) {
  // Trusted: cardNameLinkHtml escapes both the text and quoted data-card-name attribute.
  return trustedHtml(cardNameLinkHtml(name));
}
