// A deck at a glance, opened from a notice: a podmate's shared deck ("charted/updated a deck") or a
// deck just added to Try a Deck. Shows the commander, Command Spark, bracket, style, card count and
// the five profile scores, then offers to chart it on the Deck Chart.
import { deckLibrary, loadDeckLibrary } from "../../services/card-data.ts";
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

/** What the preview header says, and an optional way out when the deck can't be shown. */
interface PreviewHeader {
  title: string;
  byline: string;
  fallback?: { label: string; run(): void };
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

function unavailable(header: PreviewHeader, message: string): TemplateResult {
  const runtime = publicProfileRuntime();
  const fallback = header.fallback;
  return html`${closeButton()}
    <div class="public-profile pp-deck-preview">
      <h2 class="pp-empty-title">${header.title || "Deck"}</h2>
      <p class="pp-empty">${message}</p>
      ${
        fallback
          ? html`<div class="row tad-confirm-actions">
              <button
                class="ghost"
                id="deckPreviewProfileBtn"
                @click=${() => {
                  runtime.closeTryADeckModal();
                  fallback.run();
                }}
              >
                ${fallback.label}
              </button>
            </div>`
          : null
      }
    </div>`;
}

export function deckPreviewView(
  header: PreviewHeader,
  deck: PublicProfileAnalysis,
  artUrl: string | null,
): TemplateResult {
  const runtime = publicProfileRuntime();
  const commander = deck.commanderLabel || deck._rawCommander || "Unknown commander";
  return html`${closeButton()}
    <div class="public-profile pp-deck-preview">
      <div class="pp-header">
        ${artUrl ? html`<img src=${artUrl} alt=${commander} class="pp-commander-art" />` : null}
        <div class="pp-player-name">${header.title}</div>
        <div class="pp-commander-name">${cardNameLink(commander)}</div>
        <div class="pp-player-count">${header.byline}</div>
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

interface FoundDeck {
  title: string;
  list: string;
  commander: string;
  owner: string;
  ownerUid: string | null;
  /** Replaces the header's byline once the deck is found (a Try-a-Deck tagline). */
  byline?: string;
}

/** Opens the overlay, finds and analyses the deck, then shows it (or why it can't be shown). */
async function showPreview(
  header: PreviewHeader,
  find: () => Promise<FoundDeck | null>,
  missing: string,
): Promise<void> {
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
    show(unavailable(header, "Card database still loading — try again in a moment."));
    return;
  }
  try {
    const found = await find();
    const deck = found?.list
      ? runtime.analyzeOneList(found.list, found.owner, found.commander)
      : null;
    if (!found || !deck) {
      show(unavailable(header, missing));
      return;
    }
    deck._ownerUid = found.ownerUid;
    deck._ownerName = found.owner;
    deck._rawList = found.list;
    deck._rawCommander = found.commander;
    const artUrl = await runtime
      .fetchCardImageUrl(deck.commanders[0] || found.commander, "normal")
      .catch(() => null);
    show(
      deckPreviewView(
        { ...header, title: found.title, byline: found.byline || header.byline },
        deck,
        artUrl,
      ),
    );
  } catch (err) {
    reportError(err, { operation: "cloud", userTriggered: true });
    show(unavailable(header, "Couldn't load this deck. Check your connection and try again."));
  }
}

/** A podmate's shared deck, from a "charted/updated a deck" notice. */
export function openDeckPreviewOverlay(request: DeckPreviewRequest): Promise<void> {
  return showPreview(
    {
      title: request.deckName,
      byline: `by ${request.name || "a podmate"}`,
      fallback: {
        label: `See ${request.name || "their"} profile`,
        run: () =>
          emit("profile:player", { uid: request.uid, name: request.name, podId: request.podId }),
      },
    },
    async () => {
      const saved = await findPodmateDeck(request.uid, request.deckName);
      return saved
        ? {
            title: saved.deckName,
            list: saved.list,
            commander: saved.commander || "",
            owner: saved.player || request.name,
            ownerUid: request.uid,
          }
        : null;
    },
    "This deck isn't shared any more. It may have been renamed, deleted or made secret.",
  );
}

/** A Try-a-Deck deck, from a "new in Try a Deck" notice. */
export function openSamplePreviewOverlay({ key }: { key: string }): Promise<void> {
  return showPreview(
    { title: "New in Try a Deck", byline: "New in Try a Deck" },
    async () => {
      await loadDeckLibrary();
      const sample = deckLibrary()?.find((deck) => deck.key === key);
      if (!sample) return null;
      const tagline = typeof sample.tagline === "string" ? sample.tagline : "";
      return {
        title: String(sample.flavorName || key),
        list: sample.decklist,
        commander: sample.commander,
        owner: "",
        ownerUid: null,
        byline: tagline,
      };
    },
    "This deck isn't in Try a Deck right now.",
  );
}
