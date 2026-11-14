// Deck Log templates. Card names, deck names, player names and notes are user or podmate text and
// are always interpolated (escaped by lit), never inserted as markup.
import { cardNameLink } from "../../ui/card-name";
import { html, nothing, type TemplateResult } from "../../ui/html";
import type { DeckChange } from "../../services/cloud/deck-log";
import {
  ago,
  battlesTotal,
  cardLine,
  changeSummary,
  firstCharted,
  formatDate,
  winRate,
  type PanelState,
} from "./state";

export interface DeckLogActions {
  win(delta: 1 | -1): void;
  editNote(changeId: string | null): void;
  saveNote(changeId: string, note: string): void;
}

const message = (text: string) => html`<p class="dlog-message">${text}</p>`;

function row(label: string, value: TemplateResult | string): TemplateResult {
  return html`<div class="dlog-row">
    <dt>${label}</dt>
    <dd>${value}</dd>
  </div>`;
}

function chips(lines: readonly string[], kind: "have" | "miss"): TemplateResult {
  return html`${lines.map((line) => {
    const { qty, name } = cardLine(line);
    return html`<span class=${`kp-chip kp-chip-${kind}`}
      >${qty > 1 ? `${qty}× ` : ""}${cardNameLink(name)}</span
    >`;
  })}`;
}

function noteBlock(
  change: DeckChange,
  state: Extract<PanelState, { kind: "log" }>,
  actions: DeckLogActions,
): TemplateResult {
  if (state.mine && state.editing === change.id) {
    return html`<form
      class="dlog-note-form"
      @submit=${(event: Event) => {
        event.preventDefault();
        const input = (event.currentTarget as HTMLFormElement).elements.namedItem(
          "note",
        ) as HTMLInputElement;
        actions.saveNote(change.id, input.value);
      }}
    >
      <input name="note" maxlength="280" .value=${change.note || ""} aria-label="Note" />
      <button type="submit" ?disabled=${state.busy}>Save note</button>
      <button type="button" class="ghost" @click=${() => actions.editNote(null)}>Cancel</button>
    </form>`;
  }
  return html`${change.note ? html`<p class="dlog-note">${change.note}</p>` : nothing}
  ${
    state.mine
      ? html`<button
          type="button"
          class="ghost dlog-note-btn"
          @click=${() => actions.editNote(change.id)}
        >
          ${change.note ? "Edit note" : "Add a note"}
        </button>`
      : nothing
  }`;
}

function changeEntry(
  change: DeckChange,
  state: Extract<PanelState, { kind: "log" }>,
  actions: DeckLogActions,
): TemplateResult {
  return html`<details class="kp-combo dlog-change" ?open=${state.editing === change.id}>
    <summary class="dlog-change-head">
      <span class="dlog-change-date">${formatDate(change.at)}</span>
      <span class="dlog-change-sum">${changeSummary(change)}</span>
    </summary>
    <div class="dlog-change-body">
      ${
        change.added?.length
          ? html`<div class="kp-how-label">Added</div>
              <div class="dlog-chips">${chips(change.added, "have")}</div>`
          : nothing
      }
      ${
        change.removed?.length
          ? html`<div class="kp-how-label">Removed</div>
              <div class="dlog-chips">${chips(change.removed, "miss")}</div>`
          : nothing
      }
      ${noteBlock(change, state, actions)}
    </div>
  </details>`;
}

export function panelView(state: PanelState, actions: DeckLogActions, now: number): TemplateResult {
  switch (state.kind) {
    case "signed-out":
      return message("Sign in and save this deck to keep its Deck Log.");
    case "unsaved":
      return message(
        "Deck Log follows saved decks. Save this deck, or open one with Load a Deck, to see its history here.",
      );
    case "loading":
      return message(`Loading the Deck Log for ${state.name}…`);
    case "missing":
      return message(
        `The Deck Log for ${state.name} isn't available. It may have been deleted or made secret.`,
      );
  }
  const { deck, battles, changes } = state.log;
  const wins = Number(deck.wins) || 0;
  const total = battlesTotal(battles);
  const rate = winRate(wins, total);
  const last = deck.lastChartedAt
    ? `${ago(deck.lastChartedAt, now)}${deck.lastChartedBy ? ` by ${deck.lastChartedBy}` : ""}`
    : "Not yet";
  return html`<div class="dlog">
    <div class="dlog-title">${state.name}</div>
    <dl class="dlog-grid">
      ${row("First Charted", firstCharted(deck))}
      ${row(state.mine ? "Charted by you" : "Charted by its owner", String(Number(deck.chartCount) || 0))}
      ${row("Viewed by podmates", String(Number(deck.podViewCount) || 0))}
      ${row("Last charted", last)}
      ${row(
        "Battles",
        battles.approximate ? `${total} (${battles.approximate} approximate)` : String(total),
      )}
      ${row("Wins", rate ? `${wins} · ${rate} win rate` : String(wins))}
    </dl>
    ${
      state.mine
        ? html`<div class="row dlog-wins">
            <button
              type="button"
              id="deckLogWinBtn"
              ?disabled=${state.busy}
              @click=${() => actions.win(1)}
            >
              +1 Win
            </button>
            <button
              type="button"
              class="ghost"
              id="deckLogUndoWinBtn"
              ?disabled=${state.busy || wins === 0}
              @click=${() => actions.win(-1)}
            >
              Undo win
            </button>
          </div>`
        : nothing
    }
    ${state.error ? html`<p class="dlog-error" role="alert">${state.error}</p>` : nothing}
    <div class="dlog-changes-title">${`Change Log (${changes.length})`}</div>
    ${
      changes.length
        ? changes.map((change) => changeEntry(change, state, actions))
        : message("No card changes yet. Each save that adds or removes cards is listed here.")
    }
    ${
      battles.approximate
        ? html`<p class="dlog-foot">
            Approximate battles are older Chronicles entries by the same player with the same
            commander, from before battles recorded which saved deck was played.
          </p>`
        : nothing
    }
  </div>`;
}
