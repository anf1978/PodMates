// Escaped templates preserving the legacy Spoiler Bait structure and control labels.
import { html, nothing, type TemplateResult } from "../../ui/html";
import type { SpoilerVoteDoc } from "../../services/cloud/types";
import {
  RARITIES,
  WINDOW_DAYS,
  queue,
  rarityOf,
  unsorted,
  type BoardRow,
  type SpoilerCard,
  type SpoilerState,
  type Tab,
  type Vote,
} from "./state";

export interface Actions {
  tab(tab: Tab): void;
  rarity(key: string): void;
  allRarities(): void;
  decide(card: SpoilerCard, vote: Vote): void;
  undo(): void;
  move(vote: SpoilerVoteDoc, to: Vote): void;
  clear(key: string): void;
  open?: (name: string) => void;
}
export function note(message: string, className = ""): TemplateResult {
  return html`<div class=${`sb-note${className ? ` ${className}` : ""}`}>${message}</div>`;
}
export function modalView(close: () => void): TemplateResult {
  return html`<button class="tad-close" id="tadCloseBtn" @click=${close}>Close ×</button>
    <h2 class="sb-heading">Spoiler Bait</h2>
    <p class="sb-intro">
      ${`Swipe through the cards spoiled in the last ${WINDOW_DAYS} days. Your pod can see what bangs and what you bin.`}
    </p>
    <div id="sbHost"></div>`;
}
export function tabsView(state: SpoilerState, hasPod: boolean, actions: Actions): TemplateResult {
  const votes = [...state.votes.values()];
  const tabs: [Tab, string][] = [
    ["swipe", `Swipe (${queue(state).length})`],
    ["liked", `Bangers (${votes.filter((vote) => vote.vote === "like").length})`],
    ["binned", `Binned (${votes.filter((vote) => vote.vote === "pass").length})`],
  ];
  if (hasPod) tabs.push(["board", "Pod board"]);
  return html`<div class="sb-tabs">
      ${tabs.map(([key, label]) => html`<button type="button" data-sb-tab=${key} class=${state.tab === key ? "on" : ""} @click=${() => actions.tab(key)}>${label}</button>`)}
    </div>
    <div id="sbBody"></div>`;
}
function rarityChips(state: SpoilerState, actions: Actions): TemplateResult | typeof nothing {
  const counts = new Map<string, number>();
  for (const card of unsorted(state)) {
    const rarity = rarityOf(card);
    if (rarity) counts.set(rarity, (counts.get(rarity) || 0) + 1);
  }
  const present = RARITIES.filter(([key]) => counts.has(key));
  if (!present.length) return nothing;
  const allOn = present.every(([key]) => state.rarities.has(key));
  return html`<div class="sb-chips" role="group" aria-label="Rarity filter">
    ${present.map(([key, label]) => html`<button type="button" data-sb-rar=${key} class=${state.rarities.has(key) ? "on" : ""} @click=${() => actions.rarity(key)}>${`${label} `}<span>${counts.get(key)}</span></button>`)}<button
      type="button"
      data-sb-rar-all="1"
      class=${allOn ? "" : "on"}
      ?disabled=${allOn}
      @click=${actions.allRarities}
    >
      Show all
    </button>
  </div>`;
}
export function swipeView(state: SpoilerState, actions: Actions): TemplateResult {
  const cards = queue(state),
    card = cards[0],
    next = cards[1];
  if (!state.cards.length) return note(`No new spoilers in the last ${WINDOW_DAYS} days.`);
  const hidden = unsorted(state).length - cards.length;
  if (!card && hidden)
    return html`${rarityChips(state, actions)}${note(`${hidden} unsorted card${hidden === 1 ? " is" : "s are"} hidden by your rarity filter. Turn a rarity back on to see ${hidden === 1 ? "it" : "them"}.`, "sb-center")}`;
  if (!card)
    return html`${note(`You’ve sorted every spoiler from the last ${WINDOW_DAYS} days. New ones appear here as they are revealed.`, "sb-center")}${state.undo.length ? html`<div class="sb-center"><button type="button" class="ghost" id="sbUndo" @click=${actions.undo}>Undo last</button></div>` : nothing}`;
  const fallback = (event: Event): void => {
    const image = event.currentTarget as HTMLImageElement;
    const el = document.createElement("div");
    el.className = "sb-fallback";
    el.textContent = card.n;
    image.replaceWith(el);
  };
  return html`${rarityChips(state, actions)}
    <div class="sb-stage">
      ${next ? html`<div class="sb-card sb-under"><img alt="" src=${next.img || ""} /></div>` : nothing}
      <div
        class="sb-card"
        id="sbTop"
        tabindex="0"
        aria-label=${`${card.n}: swipe left to bang, right to bin`}
      >
        <img draggable="false" alt=${card.n} src=${card.img || ""} @error=${fallback} />
        <div class="sb-stamp sb-like">BANG</div>
        <div class="sb-stamp sb-pass">BIN</div>
      </div>
    </div>
    <div class="sb-name">${card.n}</div>
    <div class="sb-meta">
      ${`${card.setName}${card.date ? ` · ${card.date}` : ""}${card.via ? ` · via ${card.via}` : ""}`}
    </div>
    <div class="sb-btns">
      <button
        type="button"
        class="sb-btn sb-b-like"
        id="sbLike"
        aria-label="Bang"
        @click=${() => actions.decide(card, "like")}
      >
        💥 Bang</button
      ><button
        type="button"
        class="ghost"
        id="sbUndo"
        ?disabled=${!state.undo.length}
        @click=${actions.undo}
      >
        Undo</button
      ><button
        type="button"
        class="sb-btn sb-b-pass"
        id="sbPass"
        aria-label="Bin"
        @click=${() => actions.decide(card, "pass")}
      >
        ✕ Bin
      </button>
    </div>
    ${note("Swipe left for a bang, right to bin. Arrow keys work too.", "sb-center sb-hint")}`;
}
export function listView(state: SpoilerState, kind: Vote, actions: Actions): TemplateResult {
  const items = [...state.votes.values()]
    .filter((vote) => vote.vote === kind)
    .sort((a, b) => (b.votedAt || 0) - (a.votedAt || 0));
  if (!items.length)
    return note(
      kind === "like"
        ? "No bangers yet. Swipe left on a spoiler that bangs."
        : "Nothing binned yet.",
    );
  return html`<div class="sb-grid">
    ${items.map((vote) => {
      const thumb = state.cards.find((card) => card.key === vote.key)?.thumb;
      const image = thumb
        ? html`<img loading="lazy" alt=${vote.n} src=${thumb} />`
        : html`<div class="sb-fallback">${vote.n}</div>`;
      const to = kind === "like" ? "pass" : "like";
      return html`<div class="sb-tile">
        ${actions.open ? html`<button type="button" data-sb-open=${vote.n} class="sb-tile-img" @click=${() => actions.open?.(vote.n)}>${image}</button>` : html`<div class="sb-tile-img">${image}</div>`}
        <div class="sb-tile-name">${vote.n}</div>
        <div class="sb-tile-btns">
          <button
            type="button"
            class="ghost"
            data-sb-move=${vote.key}
            data-sb-to=${to}
            @click=${() => actions.move(vote, to)}
          >
            ${kind === "like" ? "Move to Binned" : "Move to Bangers"}</button
          ><button
            type="button"
            class="ghost"
            data-sb-reset=${vote.key}
            @click=${() => actions.clear(vote.key)}
          >
            Unsort
          </button>
        </div>
      </div>`;
    })}
  </div>`;
}
export function boardView(rows: BoardRow[], cards: SpoilerCard[]): TemplateResult {
  if (!rows.length) return note("Nobody in the pod has sorted a spoiler yet.");
  return html`${note("Every card your pod has sorted. Most bangs first.", "sb-board-note")}${rows.map(
    (row) => {
      const thumb = cards.find((card) => card.key === row.key)?.thumb;
      return html`<div class="sb-board-row">
        ${thumb ? html`<img loading="lazy" alt="" src=${thumb} />` : html`<div class="sb-board-ph"></div>`}
        <div class="sb-board-detail">
          <div class="sb-tile-name">${row.n}</div>
          ${row.likes.length ? html`<div class="sb-who sb-who-like">${`💥 ${row.likes.join(", ")}`}</div>` : nothing}${row.passes.length ? html`<div class="sb-who sb-who-pass">${`✕ ${row.passes.join(", ")}`}</div>` : nothing}
        </div>
      </div>`;
    },
  )}`;
}
