// Commander Centrality panel: band strip, reasons, the card grid (tap a square for its name),
// legend, symbol key and support bars against a typical deck of the same archetype.

import { CENTRALITY_BANDS } from "../../../engine/centrality-rules.ts";
import type { computeCommanderCentrality } from "../../../engine/centrality.ts";
import { html, nothing, trustedHtml } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { showInfoModal } from "../../../ui/info-modal.ts";
import { explainerButton } from "../explainers/button.ts";
import { CC_ICONS, CC_KIND_NAMES, CC_MANA, ccPips, ccTileInner, ccTileLabel } from "./glyphs.ts";

export type Centrality = NonNullable<ReturnType<typeof computeCommanderCentrality>>;

const svgMarkup = (markup: string) =>
  // Trusted: SVG built by glyphs.ts from constant paths, colours and card-type letters.
  trustedHtml(markup);

const LEVELS: [string, string][] = [
  ["cc-l4", "Commander"],
  ["cc-l3", "Essential"],
  ["cc-l2", "Linked"],
  ["cc-l1", "Support"],
  ["cc-l0", "Independent"],
];

function tileTitle(t: Centrality["tiles"][number]): string {
  const label = ccTileLabel(t);
  return t.name + (label ? " (" + label + ")" : "") + (t.why ? " — " + t.why : "");
}

function bar(i: Centrality["investment"][number], scaleMax: number): TemplateResult {
  const over = i.count > i.baseline;
  const width = Math.min(100, (i.count / scaleMax) * 100).toFixed(1);
  const left = Math.min(100, (i.baseline / scaleMax) * 100).toFixed(1);
  // prettier-ignore
  return html`<div class="cc-bar-row"><div class="cc-bar-label">${i.label}</div><div class="cc-bar-track"><div class=${over ? "cc-bar-fill over" : "cc-bar-fill"} style=${"width:" + width + "%"}></div>${i.baseline > 0 ? html`<div class="cc-bar-mark" style=${"left:" + left + "%"} title="Typical deck"></div>` : nothing}</div><div class="cc-bar-val">${String(i.count)}${i.baseline > 0 ? html` <span class="cc-bar-typ">${"/ " + +i.baseline.toFixed(1) + " typ."}</span>` : nothing}</div></div>`;
}

export function centralityTemplate(r: Centrality): TemplateResult {
  const tiles = r.tiles.slice(0, 110).map(
    (t) =>
      // prettier-ignore
      html`<span translate="no" class=${"card-name-link cc-tile cc-l" + t.level} data-card-name=${t.name} title=${tileTitle(t)}>${svgMarkup(ccTileInner(t))}</span>`,
  );
  const shown = r.investment.filter((i) => i.key !== "direct" || i.count > 0);
  const scaleMax = Math.max(8, ...shown.map((i) => Math.max(i.count, i.baseline * 2)));
  const label = r.baselineLabel ? r.baselineLabel + " " : "";
  const foot =
    `White tick = typical ${label}precon baseline deck` +
    (r.baselineLabel ? ` (from ${r.baselineN} decks)` : "") +
    ". Gold bar = this deck runs more than that.";
  // prettier-ignore
  return html`
    <div class="cc-head"><span class="cc-band">${r.band}</span>${explainerButton("commanderCentrality")}</div>
    <div class="cc-strip">${CENTRALITY_BANDS.map((b, i) => html`<span class=${i <= r.bandIndex ? "on" : ""} title=${b.label}></span>`)}</div>
    <div class="cc-blurb">${r.blurb}</div>
    <ul class="cc-reasons">${r.reasons.map((x) => html`<li>${x}</li>`)}</ul>
    ${r.notes.map((x) => html`<div class="cc-note">${x}</div>`)}
    <div class="cc-grid" id="ccGrid">${tiles}</div><div class="cc-caption" id="ccCaption" aria-live="polite">Touch a square to see what it is.</div>
    <div class="cc-legend">${LEVELS.map(([k, l]) => html`<span><i class=${"cc-sw-" + k.slice(3)}></i>${l}</span>`)}</div><button type="button" class="cc-keybtn" id="ccKeyBtn">Symbol key</button>
    <div class="cc-bars-title">${`Commander support vs. a typical ${label}deck`}</div>
    ${shown.map((i) => bar(i, scaleMax))}
    <div class="cc-foot">${foot}</div>`;
}

/** Wires the symbol-key button and the grid caption after the panel renders. */
export function bindCentrality(area: ParentNode): void {
  const kb = area.querySelector<HTMLElement>("#ccKeyBtn");
  if (kb) kb.onclick = showCentralityKey;
  const grid = area.querySelector<HTMLElement>("#ccGrid"),
    cap = area.querySelector<HTMLElement>("#ccCaption");
  if (grid && cap) {
    const show = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(".cc-tile");
      if (el && el.title) cap.textContent = el.title;
    };
    grid.addEventListener("pointerdown", show);
    grid.addEventListener("pointerover", (e) => {
      if (e.pointerType === "mouse") show(e);
    });
  }
}

function keyRow(tile: string, text: string): TemplateResult {
  // prettier-ignore
  return html`<div class="cc-tile cc-l0">${svgMarkup(tile)}</div><div>${text}</div>`;
}

export function showCentralityKey(): void {
  const ico = (k: string) =>
    `<svg viewBox="0 0 24 24" class="cc-ink" aria-hidden="true">${CC_ICONS[k]}</svg>`;
  const types = [
    "creature",
    "instant",
    "sorcery",
    "artifact",
    "enchantment",
    "planeswalker",
    "land",
    "battle",
  ];
  const dot = (c: string) =>
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    (c === "C"
      ? '<circle cx="12" cy="12" r="8" fill="#a8a8a8" stroke="rgba(255,255,255,.8)" stroke-width="1.2"/>'
      : ccPips(c)) +
    "</svg>";
  const pips = (pm: string) =>
    '<svg viewBox="0 0 24 24" aria-hidden="true">' + ccPips(pm) + "</svg>";
  const head = (t: string) => html`<div class="cc-key-h">${t}</div>`;
  // prettier-ignore
  showInfoModal(
    html`<h2>Grid symbols</h2>`,
    html`<div class="cc-key-intro">The <strong>background colour</strong> shows how the card relates to the commander. The <strong>symbol</strong> shows what the card is.</div>${head("Background (role)")}<div class="cc-key">${LEVELS.map(([k, l]) => html`<div class=${"cc-tile " + k}></div><div>${l}</div>`)}</div>${head("Card type")}<div class="cc-key">${types.map((k) => keyRow(ico(k), CC_KIND_NAMES[k] as string))}</div>${head("Land colours")}<div class="cc-key">${["W", "U", "B", "R", "G", "C"].map((c) => keyRow(dot(c), (CC_MANA[c] as [string, string])[1]))}${keyRow(pips("WG"), "Two or more dots: a land that makes several colours")}${keyRow(pips("WUBRG"), "Five-colour wheel: makes any colour")}</div><div class="cc-key-foot">Lands that make no coloured mana show the mountain symbol. Hold or tap a square for the card name, type and role.</div>`,
  );
}
