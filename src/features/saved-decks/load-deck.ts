// Load a Deck: your saved decks plus podmates' shared ones, into the form or a Gathering seat.
import { action } from "../../services/cloud/operations";
import { deleteDeck, setDeckSecret } from "../../services/cloud/decks";
import { setSeatDeck } from "../../services/cloud/gatherings";
import { getCurrentUser } from "../../services/cloud/session";
import { searchNorm } from "../../cards/search";
import { decklistProblem } from "../../services/decklist-limits";
import { emit } from "../../services/events";
import { dropLinkedDuplicates } from "../../services/linked-duplicates";
import {
  forgetSavedDeck,
  loadSavedDecks,
  podmateSavedDecks,
  refreshPodmateDecks,
  refreshSavedDecks,
  withTimeout,
  type DeckPickTarget,
} from "../../services/saved-decks";
import { showConfirmModal } from "../../ui/confirm";
import { html, nothing, render, type TemplateResult } from "../../ui/html";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import { showToast } from "../../ui/toast";
import { field, setDeckStatus } from "./form";
import {
  chipsView,
  listView,
  loadingView,
  noMatchView,
  retryView,
  shellView,
  type ListEntry,
} from "./load-deck-view";
import { ports } from "./ports";

const cloud = {
  deleteDeck: action(deleteDeck),
  setDeckSecret: action(setDeckSecret),
  setSeatDeck: action(setSeatDeck),
};

let activePlayer: string | null = null;
let target: DeckPickTarget | "main" = "main";

const anyDecks = () =>
  Object.keys(loadSavedDecks()).length > 0 || Object.keys(podmateSavedDecks()).length > 0;

function loadDeckByKey(key: string, to: DeckPickTarget | "main"): void {
  const entry = loadSavedDecks()[key] || podmateSavedDecks()[key];
  if (!entry) return;
  if (to !== "main") {
    const g = to.gatheringSeat;
    const commander = entry.commander || key;
    const list = entry.list || "";
    const seatListProblem = decklistProblem(list);
    if (seatListProblem) {
      showToast(seatListProblem);
      return;
    }
    // Fire-and-forget: the row click that calls this doesn't wait either.
    cloud
      .setSeatDeck(g.podId, g.gatheringId, g.seatIndex, { commander, list, cardCount: null })
      .then(() => {
        closeTryADeckModal();
        emit("gatherings:open", { podId: g.podId, id: g.gatheringId });
        showToast(`Loaded "${key}" into Seat ${g.seatIndex + 1}.`);
      })
      .catch((err: Error) => {
        showToast("Could not save that deck to the seat: " + err.message);
      });
    return;
  }
  field<HTMLTextAreaElement>("decklistInput")!.value = entry.list || "";
  const commander = field<HTMLInputElement>("commanderInput");
  if (commander) commander.value = entry.commander || "";
  const player = field<HTMLInputElement>("playerInput");
  if (player) player.value = entry.player || "";
  const name = field<HTMLInputElement>("deckNameInput");
  if (name) {
    name.value = ("deckName" in entry && entry.deckName) || key;
    ports().nameChosen();
  }
  setDeckStatus(`Loaded “${key}”.`);
  const chart = field("chartBtn");
  if (chart) {
    chart.classList.add("tad-pulsing");
    if (chart.scrollIntoView) chart.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

/** Redraws the player chips, if the dialog is open. */
export function renderPlayerChips(): void {
  const area = field("loadDeckPlayerChips");
  if (!area) return;
  const players = [
    ...new Set(
      [
        ...Object.values(loadSavedDecks()).map((e) => (typeof e === "object" && e.player) || ""),
        ...Object.values(podmateSavedDecks()).map((e) => e.ownerName || ""),
      ].filter(Boolean),
    ),
  ].sort();
  render(chipsView(players, activePlayer), area);
}

function entries(): ListEntry[] {
  const searchEl = field<HTMLInputElement>("loadDeckSearch");
  const search = searchNorm(searchEl ? searchEl.value : "");
  let list: ListEntry[] = Object.entries(loadSavedDecks()).map(([key, entry]) => ({
    key,
    mine: true,
    ...entry,
  }));
  // Podmates' shared decks, tagged with their real account name (not the free-text "player"
  // label), so it's always clear whose deck is whose in the merged list.
  list.push(
    ...Object.entries(podmateSavedDecks()).map(([key, entry]) => ({
      key,
      ...entry,
      player: entry.ownerName,
    })),
  );
  list = dropLinkedDuplicates(list); // a linked deck that was also charted and saved shows once
  if (activePlayer) list = list.filter((e) => e.player === activePlayer);
  if (search) {
    list = list.filter(
      (e) =>
        searchNorm(e.key).includes(search) ||
        searchNorm(e.commander || "").includes(search) ||
        searchNorm(e.player || "").includes(search),
    );
  }
  return list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0) || a.key.localeCompare(b.key));
}

/** Redraws the deck rows, if the dialog is open. Any retry notice shows only until the next redraw. */
export function renderDeckList(notice: TemplateResult | typeof nothing = nothing): void {
  const listArea = field("loadDeckListArea");
  if (!listArea) return;
  const shown = entries();
  render(html`${notice}${shown.length ? listView(shown) : noMatchView()}`, listArea);
}

export function redrawIfOpen(): void {
  if (field("loadDeckListArea") && anyDecks()) {
    renderPlayerChips();
    renderDeckList();
  }
}

export async function showLoadDeckModal(to?: DeckPickTarget | Event): Promise<void> {
  const seat = to && "gatheringSeat" in to ? to.gatheringSeat : null;
  // Only pre-filter to the seat's player when it's someone ELSE's seat: your own saved decks use a
  // free-typed "player" label that may not match your display name. A guest has no decks of their
  // own, so a guest seat sees every pod deck.
  const seatIsMine = !!seat && seat.seatUid === (getCurrentUser()?.uid ?? null);
  activePlayer = seat && !seatIsMine && !seat.seatIsGuest ? seat.seatDisplayName : null;
  target = seat ? (to as DeckPickTarget) : "main";
  const { modal } = openTadOverlay();
  const suffix = seat
    ? ` — Seat ${(Number(seat.seatIndex) || 0) + 1} (${seat.seatDisplayName}${seat.seatIsGuest ? ", guest" : ""})`
    : "";
  render(
    shellView("Load a Deck" + suffix, closeTryADeckModal, () => renderDeckList()),
    modal,
  );
  render(loadingView(), field("loadDeckListArea")!);

  // Whatever is already in memory shows straight away; fresh copies are then fetched. "No saved
  // decks" is only ever shown when a load SUCCEEDED and really found nothing.
  if (anyDecks()) {
    renderPlayerChips();
    renderDeckList();
  }
  const [own, podmates] = await Promise.all([
    withTimeout(refreshSavedDecks(), 20000, "Loading your decks").catch(() => false),
    withTimeout(refreshPodmateDecks(), 20000, "Loading podmates' decks").catch(() => ({
      ok: false,
    })),
  ]);
  const ownOk = own === true;
  const anyFailed = !ownOk || !(podmates && podmates.ok);
  const listArea = field("loadDeckListArea");
  if (!listArea) return; // the modal was closed while loading
  const retry = () => void showLoadDeckModal(seat ? (to as DeckPickTarget) : undefined);

  if (!anyDecks()) {
    if (anyFailed) {
      render(retryView(ownOk, retry), listArea);
      return;
    }
    closeTryADeckModal();
    if (seat)
      showToast("No saved decks in this pod yet -- save one from the Deck Chart tab first.");
    else setDeckStatus("No saved decks yet — save one first.", true);
    return;
  }
  renderPlayerChips();
  renderDeckList(anyFailed ? retryView(ownOk, retry) : nothing);
}

function toggleSecret(button: HTMLButtonElement): void {
  const key = button.getAttribute("data-toggle-secret-key")!;
  if (!ports().requireAccount("decks")) return;
  const entry = loadSavedDecks()[key];
  if (!entry) return;
  const newSecret = !entry.secret;
  button.disabled = true;
  cloud
    .setDeckSecret(key, newSecret)
    .then(async () => {
      await refreshSavedDecks();
      renderPlayerChips();
      renderDeckList();
      setDeckStatus(
        newSecret
          ? `"${key}" is now secret -- only you can load it.`
          : `"${key}" is now visible to your pod.`,
      );
    })
    .catch((err: Error) => {
      button.disabled = false;
      setDeckStatus("Could not change that: " + err.message, true);
    });
}

function confirmDelete(button: Element): void {
  const key = button.getAttribute("data-delete-deck-key")!;
  const docId = button.getAttribute("data-delete-doc-id") || null;
  if (!ports().requireAccount("decks")) return;
  showConfirmModal(`Delete saved deck "${key}"?`, async () => {
    try {
      await cloud.deleteDeck(key, docId ?? undefined);
      forgetSavedDeck(key); // gone from the screen at once, even if the refresh below is slow
      await refreshSavedDecks();
      renderPlayerChips();
      renderDeckList();
      setDeckStatus("Deleted.");
    } catch (err) {
      setDeckStatus("Could not delete: " + (err as Error).message, true);
    }
  });
}

/** Delegated clicks for the dialog's chips, toggles, deletes and rows (registered once). */
export function onDocumentClick(e: MouseEvent): void {
  const el = e.target instanceof Element ? e.target : null;
  if (!el) return;
  const chip = el.closest("[data-load-player]");
  if (chip) {
    const p = chip.getAttribute("data-load-player");
    activePlayer = activePlayer === p ? null : p;
    renderPlayerChips();
    renderDeckList();
    return;
  }
  const secret = el.closest<HTMLButtonElement>("[data-toggle-secret-key]");
  if (secret) return toggleSecret(secret);
  const remove = el.closest("[data-delete-deck-key]");
  if (remove) return confirmDelete(remove);
  const row = el.closest("[data-load-deck-key]");
  if (row) {
    loadDeckByKey(row.getAttribute("data-load-deck-key")!, target);
    closeTryADeckModal();
  }
}
