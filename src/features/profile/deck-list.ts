// Unified saved/linked deck rows and their refresh/remove/summary actions.
import { deleteDeck } from "../../services/cloud/decks";
import { refreshLinkedDeck, removeLinkedDeck } from "../../services/cloud/linked-decks";
import { reportError } from "../../services/report-error";
import { html, nothing, render } from "../../ui/html";
import { showToast } from "../../ui/toast";
import { loadAndMergeMyDecks } from "./decks";
import { errorMessage } from "./account";
import { profileRuntime } from "./runtime";
import { myDecksSummaryCache, openDeckSummaryPopup } from "./summary";
import type { ProfileDeck } from "./state";

export function renderMyDecksList(modal: HTMLElement, decks: ProfileDeck[]): void {
  const container = modal.querySelector<HTMLElement>("#profileLinkedDecks");
  if (!container) return;
  const count = modal.querySelector("#profileDeckCount");
  if (count) count.textContent = `(${decks.length})`;
  if (!decks.length) {
    render(
      html`<div class="profile-empty">
        No decks saved yet — use "Save Deck" on the Chart Deck page, or add a link above.
      </div>`,
      container,
    );
    return;
  }
  render(
    html`${decks.map((deck) => {
      const source =
        deck.source === "archidekt"
          ? "Archidekt"
          : deck.source === "moxfield"
            ? "Moxfield"
            : "Saved";
      const bits = [source];
      if (deck.commander) bits.push(deck.commander);
      if (deck.source === "saved" && deck.player) bits.push(deck.player);
      bits.push(`${deck.cardCount} cards`);
      return html` <div class="profile-deck-row">
        <div class="profile-deck-top">
          <div class="profile-deck-title">
            <div
              class="pm-deck-name-link"
              data-action="view-summary"
              data-id=${deck.id}
              @click=${() => openDeckSummaryPopup(deck)}
            >
              ${deck.name}
            </div>
            <div class="profile-deck-subtitle">${bits.join(" · ")}</div>
            ${deck.isLinked ? html`<div class="profile-linked-hint">${`Linked to ${source} — Refresh pulls in whatever the deck looks like there right now.`}</div>` : nothing}
          </div>
          <div class="profile-deck-actions">
            ${deck.url ? html`<button class="ghost profile-deck-action" data-action="refresh" data-id=${deck.id} @click=${(event: Event) => refresh(event, modal, deck)}>Refresh</button>` : nothing}
            <button
              class="ghost profile-deck-action profile-deck-remove"
              data-action="remove"
              data-id=${deck.id}
              @click=${(event: Event) => remove(event, modal, deck)}
            >
              Remove
            </button>
          </div>
        </div>
      </div>`;
    })}`,
    container,
  );
}

async function refresh(event: Event, modal: HTMLElement, deck: ProfileDeck): Promise<void> {
  event.stopPropagation();
  const button = event.currentTarget as HTMLButtonElement;
  button.disabled = true;
  button.textContent = "…";
  try {
    const result = await refreshLinkedDeck(deck.rawId!, deck.url!);
    if (result.ok) {
      myDecksSummaryCache.delete(deck.id);
      const refreshed = await loadAndMergeMyDecks();
      if (modal.isConnected) renderMyDecksList(modal, refreshed);
      showToast(`“${deck.name}” refreshed.`);
    } else {
      showToast(`Could not refresh: ${result.error}`);
    }
  } catch (error) {
    reportError(error, { operation: "cloud", userTriggered: true });
    showToast(`Could not refresh: ${errorMessage(error)}`);
  } finally {
    button.disabled = false;
    button.textContent = "Refresh";
  }
}

function remove(event: Event, modal: HTMLElement, deck: ProfileDeck): void {
  event.stopPropagation();
  profileRuntime().confirm(`Remove "${deck.name}" from your profile?`, async () => {
    try {
      if (deck.source === "saved") await deleteDeck(deck.rawKey);
      else await removeLinkedDeck(deck.rawId!);
      myDecksSummaryCache.delete(deck.id);
      const refreshed = await loadAndMergeMyDecks();
      if (modal.isConnected) renderMyDecksList(modal, refreshed);
    } catch (error) {
      reportError(error, { operation: "cloud", userTriggered: true });
      showToast(`Could not remove this deck: ${errorMessage(error)}`);
    }
  });
}
