// Card art templates. URLs and names are ordinary bindings; nothing here builds markup from strings.
// The flip button keeps the `data-flip-btn` / `data-alt` contract read by the page's delegated
// click handler, which swaps the nearest image's source.
import { html, nothing, type TemplateResult } from "../../ui/html";
import type { CardImageMap } from "../../services/card-art";
import type { ViewerGroup, ViewerTile } from "./state";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function flipButton(otherUrl: string | null | undefined, big: boolean) {
  if (!otherUrl) return nothing;
  return big
    ? html`<div class="cv-flip-row">
        <button type="button" class="ghost" data-flip-btn data-alt=${otherUrl}>Flip card ⟲</button>
      </div>`
    : html`<button
        type="button"
        class="cv-flip"
        data-flip-btn
        data-alt=${otherUrl}
        aria-label="Flip card"
        title="Flip card"
      >
        ⟲
      </button>`;
}

/** Per-card and header extras (deck notes), drawn by the page; see index.ts DeckViewExtras. */
export interface ViewerExtras {
  header(): unknown;
  tile(name: string): unknown;
}

function tile(
  { name, qty }: ViewerTile,
  urls: CardImageMap,
  extras?: ViewerExtras,
): TemplateResult {
  const url = urls.get(name);
  const extra = extras ? extras.tile(name) : nothing;
  if (!url) {
    const label = html`<span class="cv-placeholder-name">${name}</span>`;
    return html`<div class="cv-placeholder">${label}${extra}</div>`;
  }
  return html`<div class="cv-tile">
    ${flipButton(urls.getOther(name), false)}<img
      class="cv-tile-img"
      src=${url}
      alt=${name}
      loading="lazy"
      title=${name}
    />
    ${qty > 1 ? html`<span class="cv-qty">${`×${qty}`}</span>` : nothing}${extra}
  </div>`;
}

const grid = (tiles: ViewerTile[], urls: CardImageMap, extras?: ViewerExtras) =>
  html`<div class="cv-grid">${tiles.map((t) => tile(t, urls, extras))}</div>`;

export const loadingTemplate = () => html`<p class="cv-loading">Loading card art…</p>`;

export function deckTemplate(
  lines: number,
  groups: ViewerGroup[],
  urls: CardImageMap,
  missing: number,
  close: () => void,
  extras?: ViewerExtras,
): TemplateResult {
  const summary =
    plural(lines, "card line") + (missing ? ` · ${plural(missing, "card")} shown without art` : "");
  return html`<button class="tad-close" id="tadCloseBtn" @click=${close}>Close ×</button>
    <h2 class="cv-title">View Deck</h2>
    <p class="cv-summary">${summary}</p>
    ${extras ? extras.header() : nothing}
    ${groups.map(
      (g) =>
        html`<div class="cv-section">
          <div class="cv-section-title">${`${g.name} (${g.count})`}</div>
          ${grid(g.tiles, urls, extras)}
        </div>`,
    )}`;
}

export function typeTemplate(
  typeName: string,
  tiles: ViewerTile[],
  urls: CardImageMap,
  missing: number,
  close: () => void,
): TemplateResult {
  const total = tiles.reduce((sum, t) => sum + t.qty, 0);
  const summary = plural(total, "card") + (missing ? ` · ${missing} shown without art` : "");
  return html`<button class="tad-close" id="tadCloseBtn" @click=${close}>Close ×</button>
    <h2 class="cv-title">${typeName}</h2>
    <p class="cv-summary">${summary}</p>
    ${grid(tiles, urls)}`;
}

/** `art` is undefined while loading, null when Scryfall has no image. */
export function singleArtTemplate(
  name: string,
  art: { url: string; other: string | null } | null | undefined,
  close: () => void,
): TemplateResult {
  let body: unknown = "Loading art…";
  if (art === null) body = "Could not find art for this card.";
  else if (art)
    body = html`<img
        class="cv-art-img"
        src=${art.url}
        alt=${name}
      />${flipButton(art.other, true)}`;
  return html`<button class="tad-close" id="tadArtCloseBtn" @click=${close}>Close ×</button>
    <h2 class="cv-art-title">${name}</h2>
    <div id="singleCardArtArea" class="cv-art-area">${body}</div>`;
}

export interface HeroSlot {
  name: string;
  url?: string | null;
  other?: string | null;
}

export function heroTemplate(slots: HeroSlot[]): TemplateResult {
  return html`<div class="cv-hero">
    ${slots.map(
      (s, i) =>
        html`<div
          id=${`commanderHeroSlot${i}`}
          class=${s.url ? "cv-hero-slot cv-shown" : "cv-hero-slot"}
        >
          ${
            s.url
              ? html`<img
                    class="cv-hero-img"
                    src=${s.url}
                    alt=${s.name}
                    loading="lazy"
                  />${flipButton(s.other, false)}`
              : nothing
          }
        </div>`,
    )}
  </div>`;
}
