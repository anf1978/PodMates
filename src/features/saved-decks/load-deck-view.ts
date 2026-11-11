// Load a Deck templates: the dialog shell, player chips and the deck rows. Clicks are delegated
// (see load-deck.ts) through the data-* attributes, as before.
import { linkedSite } from "../../services/linked-duplicates";
import { cardNameLink } from "../../ui/card-name";
import { html, nothing, type TemplateResult } from "../../ui/html";

export interface ListEntry {
  key: string;
  mine: boolean;
  list?: string;
  commander?: string;
  player?: string;
  savedAt?: number;
  secret?: boolean;
  docId?: string;
  linkedVia?: string;
  ownerUid?: string;
  ownerName?: string;
}

export function shellView(title: string, onClose: () => void, onSearch: () => void) {
  return html`<button class="tad-close" id="tadCloseBtn" @click=${onClose}>Close ×</button>
    <h2 class="saved-decks-title">${title}</h2>
    <input
      type="text"
      id="loadDeckSearch"
      placeholder="Search by commander or player…"
      @input=${onSearch}
    />
    <div id="loadDeckPlayerChips"></div>
    <div id="loadDeckListArea"></div>`;
}

export const loadingView = () => html`<div class="load-deck-empty">Loading…</div>`;
export const noMatchView = () => html`<div class="load-deck-empty">No saved decks match.</div>`;

export function retryView(ownOk: boolean, onRetry: () => void) {
  const message = ownOk
    ? "Some podmates' decks didn't load (slow connection?). "
    : "Your decks didn't finish loading (slow connection?). ";
  return html`<div id="loadDeckRetryNotice">
    ${message}<button type="button" id="loadDeckRetryBtn" @click=${onRetry}>Retry</button>
  </div>`;
}

export function chipsView(players: string[], active: string | null) {
  return players.map(
    (p) =>
      html`<button
        type="button"
        class=${p === active ? "load-deck-chip active" : "load-deck-chip"}
        data-load-player=${p}
      >
        ${p}
      </button>`,
  );
}

function linkedBadge(e: ListEntry) {
  const site =
    e.linkedVia ||
    (typeof e.docId === "string" && e.docId.indexOf("linked-") === 0 && linkedSite(e.docId));
  if (!site) return nothing;
  const name = e.linkedVia || linkedSite(e.docId);
  return html`<span
    class="load-deck-linked"
    title=${`Linked to a deck on ${name} and kept in sync from My Profile`}
    >${`\u{1F517} ${name}`}</span
  >`;
}

function rowView(e: ListEntry): TemplateResult {
  const dateLabel = e.savedAt ? new Date(e.savedAt).toLocaleDateString() : "";
  const badge = linkedBadge(e);
  const meta =
    (e.player || "") + (dateLabel ? " · " + dateLabel : "") + (badge === nothing ? "" : " ");
  const secret = e.mine
    ? html`<button
        type="button"
        class=${e.secret ? "load-deck-action secret" : "load-deck-action"}
        data-toggle-secret-key=${e.key}
        title=${
          e.secret
            ? "Secret — only you can load this. Click to share with your pod."
            : "Click to keep this deck secret from your pod"
        }
      >
        ${e.secret ? "🔒" : "🔓"}
      </button>`
    : nothing;
  const remove = e.mine
    ? html`<button
        type="button"
        class="load-deck-action"
        data-delete-deck-key=${e.key}
        data-delete-doc-id=${e.docId || ""}
        title="Delete"
      >
        ×
      </button>`
    : nothing;
  return html`<div class="load-deck-row">
    <div class="load-deck-pick" data-load-deck-key=${e.key}>
      <div class="load-deck-name">${e.commander ? cardNameLink(e.commander) : e.key}</div>
      <div class="load-deck-meta">${meta}${badge}</div>
    </div>
    <div class="load-deck-actions">${secret}${remove}</div>
  </div>`;
}

export const listView = (entries: ListEntry[]) => entries.map(rowView);
