// Saved Decks: Save Deck, Load a Deck (also for Gathering seats) and Build Table. The deck data
// itself lives in src/services/saved-decks.ts, shared with My Profile and player profiles.
import { onAuthChange } from "../../services/cloud/session";
import { on } from "../../services/events";
import { refreshPodmateDecks, refreshSavedDecks, waitCloudReady } from "../../services/saved-decks";
import { onDocumentClick, redrawIfOpen, showLoadDeckModal } from "./load-deck";
import { configure, type SavedDecksPorts } from "./ports";
import { saveCurrentDeck } from "./save";
import { buildSavedDecksTable } from "./table";
import "./saved-decks.css";

// Keep the deck lists fresh without asking anyone to sign in again: when the app is opened or
// brought back (home-screen icon, switching apps), when the network returns, and when sign-in is
// confirmed. A quiet refresh; if Load a Deck is open it redraws with the new data.
function warmDeckCaches(): void {
  let last = 0;
  const soft = (force: boolean) => {
    if (!force && Date.now() - last < 15000) return;
    last = Date.now();
    Promise.all([refreshSavedDecks(), refreshPodmateDecks()])
      .then(redrawIfOpen)
      .catch(() => {});
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") soft(false);
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) soft(true);
  });
  window.addEventListener("online", () => soft(true));
  window.addEventListener("focus", () => soft(false));
  void waitCloudReady(20000).then((ok) => {
    if (ok) onAuthChange((u) => u && soft(true));
  });
}

export function mount(ports: SavedDecksPorts): void {
  configure(ports);
  document.getElementById("saveDeckBtn")?.addEventListener("click", saveCurrentDeck);
  document
    .getElementById("loadDeckBtn")
    ?.addEventListener("click", (e) => void showLoadDeckModal(e));
  document
    .getElementById("buildSavedDecksTableBtn")
    ?.addEventListener("click", () => void buildSavedDecksTable());
  document.addEventListener("click", onDocumentClick);
  on("decks:save", saveCurrentDeck);
  on("decks:pick", (target) => void showLoadDeckModal(target));
  // Fetches fresh for a signed-in user, clears back to empty after signing out.
  onAuthChange(() => void refreshSavedDecks());
  warmDeckCaches();
}
