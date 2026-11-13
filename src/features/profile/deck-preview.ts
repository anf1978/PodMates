// A podmate's shared deck at a glance, opened from a deck notice: who built it, the commander, its
// Command Spark, bracket and five profile scores, then a choice to chart it on the Deck Chart.
import { findPodmateDeck } from "../../services/cloud/decks.ts";
import { emit } from "../../services/events.ts";
import { reportError } from "../../services/report-error.ts";
import { html, render, type TemplateResult } from "../../ui/html.ts";
import { cardNameLink } from "../../ui/card-name.ts";
import { publicProfileRuntime } from "./public-runtime.ts";
import type { PublicProfileAnalysis } from "./public-types.ts";

export interface DeckPreviewRequest {
  uid: string;
  name: string;
  podId: string;
  deckName: string;
}

const AXES = [
  ["speed", "Speed"],
  ["consistency", "Consistency"],
  ["versatility", "Versatility"],
  ["disruption", "Disruption"],
  ["powerLevel", "Power Level"],
] as const;

const score = (value: number | undefined): string =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "–";

function closeButton(): TemplateResult {
  const runtime = publicProfileRuntime();
  return html`<button
    class="tad-close"
    id="tadCloseBtn"
    @click=${() => runtime.closeTryADeckModal()}
  >
    Close ×
  </button>`;
}

function unavailable(request: DeckPreviewRequest, message: string): TemplateResult {
  const runtime = publicProfileRuntime();
  return html`${closeButton()}
    <div class="public-profile pp-deck-preview">
      <h2 class="pp-empty-title">${request.deckName || "Deck"}</h2>
      <p class="pp-empty">${message}</p>
      <div class="row tad-confirm-actions">
        <button
          class="ghost"
          id="deckPreviewProfileBtn"
          @click=${() => {
            runtime.closeTryADeckModal();
            emit("profile:player", { uid: request.uid, name: request.name, podId: request.podId });
          }}
        >
          ${`See ${request.name || "their"} profile`}
        </button>
      </div>
    </div>`;
}

export function deckPreviewView(
  request: DeckPreviewRequest,
  deck: PublicProfileAnalysis,
  artUrl: string | null,
): TemplateResult {
  const runtime = publicProfileRuntime();
  const commander = deck.commanderLabel || deck._rawCommander || "Unknown commander";
  return html`${closeButton()}
    <div class="public-profile pp-deck-preview">
      <div class="pp-header">
        ${artUrl ? html`<img src=${artUrl} alt=${commander} class="pp-commander-art" />` : null}
        <div class="pp-player-name">${request.deckName}</div>
        <div class="pp-commander-name">${cardNameLink(commander)}</div>
        <div class="pp-player-count">${`by ${request.name || "a podmate"}`}</div>
      </div>
      <dl class="pp-deck-stats">
        <div>
          <dt>Command Spark</dt>
          <dd>${score(deck.commandSpark)}</dd>
        </div>
        <div>
          <dt>Bracket</dt>
          <dd>${deck.bracket?.bracket || deck.bracket?.bracketKey || "–"}</dd>
        </div>
        <div>
          <dt>Style</dt>
          <dd>${deck.style || "–"}</dd>
        </div>
        <div>
          <dt>Cards</dt>
          <dd>${typeof deck.totalCards === "number" ? String(deck.totalCards) : "–"}</dd>
        </div>
      </dl>
      <ul class="pp-deck-axes">
        ${AXES.map(
          ([key, label]) =>
            html`<li><span>${label}</span><strong>${score(deck.scores[key])}</strong></li>`,
        )}
      </ul>
      <div class="row tad-confirm-actions">
        <button class="ghost" id="deckPreviewCloseBtn" @click=${() => runtime.closeTryADeckModal()}>
          Close
        </button>
        <button
          id="deckPreviewChartBtn"
          @click=${() => {
            runtime.closeTryADeckModal();
            runtime.chartDeck(deck);
          }}
        >
          Chart this deck
        </button>
      </div>
    </div>`;
}

/** Opens the preview overlay and fills it once the deck is found and analysed. */
export async function openDeckPreviewOverlay(request: DeckPreviewRequest): Promise<void> {
  const runtime = publicProfileRuntime();
  const { modal } = runtime.openTadOverlay();
  render(
    html`${closeButton()}
      <div class="public-profile"><p class="pp-loading">Loading deck…</p></div>`,
    modal,
  );
  const show = (view: TemplateResult) => {
    if (modal.isConnected) render(view, modal);
  };
  if (!runtime.isDbReady()) {
    show(unavailable(request, "Card database still loading — try again in a moment."));
    return;
  }
  try {
    const saved = await findPodmateDeck(request.uid, request.deckName);
    const deck =
      saved && saved.list
        ? runtime.analyzeOneList(saved.list, saved.player || request.name, saved.commander || "")
        : null;
    if (!saved || !deck) {
      show(
        unavailable(
          request,
          "This deck isn't shared any more. It may have been renamed, deleted or made secret.",
        ),
      );
      return;
    }
    deck._ownerUid = request.uid;
    deck._ownerName = saved.player || request.name;
    deck._rawList = saved.list;
    deck._rawCommander = saved.commander;
    const artUrl = await runtime
      .fetchCardImageUrl(deck.commanders[0] || saved.commander, "normal")
      .catch(() => null);
    show(deckPreviewView({ ...request, deckName: saved.deckName }, deck, artUrl));
  } catch (err) {
    reportError(err, { operation: "cloud", userTriggered: true });
    show(unavailable(request, "Couldn't load this deck. Check your connection and try again."));
  }
}
