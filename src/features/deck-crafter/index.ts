// Public Deck Crafter lifecycle and controller; page orchestration is injected until p3-6.
import "./deck-crafter.css";
import { render } from "../../ui/html";
import { showToast } from "../../ui/toast";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import { openCardScanner, registerDeckEditor } from "../../services/deck-editing";
import { PM_LIMITS } from "../../services/cloud/limits";
import { clearDraft, loadDraft, saveDraft } from "./draft";
import {
  addCard,
  addPartner,
  commanderNames,
  createState,
  deckText,
  fromDecklist,
  fitsIdentity,
  identityCard,
  removeCommander,
  restore,
  setCommander,
  setQuantity,
} from "./state";
import { crafterTemplate } from "./view";
import { commanderTemplate, listTemplate } from "./panels";
import { wireSearch } from "./search";
import type { CrafterPorts } from "./ports";

export type { CrafterPorts } from "./ports";
const state = createState();
let ports: CrafterPorts;
let cleanSearches: (() => void)[] = [];

function input(id: string): HTMLInputElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Missing Deck Crafter input: ${id}`);
  }
  return element;
}

function decklist(): HTMLTextAreaElement {
  const element = document.getElementById("decklistInput");
  if (!(element instanceof HTMLTextAreaElement)) throw new Error("Missing decklist input");
  return element;
}

function button(id: string, action: () => void): void {
  document.getElementById(id)?.addEventListener("click", action);
}

function currentDeck() {
  return fromDecklist(decklist().value, input("commanderInput").value, input("playerInput").value);
}

function refreshList(): void {
  saveDraft(state);
  const list = document.getElementById("dbDeckList");
  if (!list) return;
  const count = document.getElementById("dbCardCount");
  if (count)
    count.textContent = String(Object.values(state.cards).reduce((sum, qty) => sum + qty, 0));
  // The legacy list rebuilt its controls on every edit, including dropping quantity focus.
  const active = document.activeElement;
  if (active instanceof HTMLElement && list.contains(active)) active.blur();
  render(null, list);
  render(
    listTemplate(
      state,
      ports.findCard,
      (name, value) => {
        setQuantity(state, name, value);
        refreshList();
      },
      (name) => {
        delete state.cards[name];
        refreshList();
      },
    ),
    list,
  );
}

function refreshCommander(): void {
  const display = document.getElementById("dbCommanderDisplay");
  if (!display) return;
  const names = commanderNames(state.commander);
  document.getElementById("dbIdentityRow")?.classList.toggle("db-identity-visible", !!names.length);
  const name = document.getElementById("dbIdentityName");
  if (name) name.textContent = names.join(" + ");
  input("dbIdentityToggle").checked = state.filterByIdentity;
  input("dbCommanderSearch").placeholder = state.addingPartner
    ? "Search for the partner or Background…"
    : names.length
      ? "Search to replace the commander…"
      : "Search for a commander…";
  render(null, display);
  render(
    commanderTemplate(
      state,
      ports.findCard,
      (index) => {
        removeCommander(state, index);
        refreshCommander();
        refreshList();
      },
      () => {
        state.addingPartner = !state.addingPartner;
        refreshCommander();
        if (state.addingPartner) input("dbCommanderSearch").focus();
      },
    ),
    display,
  );
}

function rerunSearch(): void {
  const field = input("dbCardSearch");
  if (field.value.trim().length >= 2) field.dispatchEvent(new Event("input"));
}

function stopSearches(): void {
  for (const clean of cleanSearches) clean();
  cleanSearches = [];
}

export function openDeckBuilderOverlay(options?: { blank?: boolean }): void {
  if (!ports.ready()) {
    showToast("Card database still loading — try again in a moment.");
    return;
  }
  stopSearches();
  const current = options?.blank ? null : currentDeck();
  const restored = restore(state, loadDraft(), current, input("playerInput").value.trim());
  const { modal } = openTadOverlay({ modalStyle: "max-width:480px" });
  modal.classList.add("deck-crafter");
  render(crafterTemplate(state, restored, current), modal);
  button("tadCloseBtn", () => {
    stopSearches();
    closeTryADeckModal();
  });
  button("dbLoadCurrentBtn", () => {
    if (!current) return;
    state.cards = { ...current.cards };
    state.commander = current.commander;
    state.player = current.player;
    input("dbPlayerInput").value = state.player;
    refreshCommander();
    refreshList();
    document.getElementById("dbDraftNotice")?.remove();
    showToast(`Loaded ${state.commander || "the current decklist"} into the builder.`);
  });
  input("dbPlayerInput").addEventListener("input", () => {
    state.player = input("dbPlayerInput").value.trim();
    saveDraft(state);
  });
  button("dbStartNewBtn", () => {
    ports.confirm(
      "Start a new deck? This clears everything currently in the builder — there’s no way back to it after this.",
      "Start New",
      () => {
        clearDraft();
        state.addingPartner = false;
        state.cards = {};
        state.commander = null;
        openDeckBuilderOverlay({ blank: true });
      },
      () => openDeckBuilderOverlay(),
    );
  });
  refreshCommander();
  refreshList();
  cleanSearches.push(
    wireSearch(
      input("dbCommanderSearch"),
      document.getElementById("dbCommanderResults")!,
      ports,
      () => ({ preferCommanders: true }),
      (card) => {
        if (state.addingPartner && commanderNames(state.commander).length)
          addPartner(state, card.n);
        else setCommander(state, card.n);
        refreshCommander();
        refreshList();
        rerunSearch();
      },
      (card) =>
        `✓ ${card.n}${state.addingPartner ? " added as your second commander" : " set as commander and added to your deck"}`,
      true,
    ),
  );
  cleanSearches.push(
    wireSearch(
      input("dbCardSearch"),
      document.getElementById("dbCardResults")!,
      ports,
      () => {
        if (!state.filterByIdentity || !state.commander) return null;
        const identity = identityCard(state, ports.findCard);
        return identity ? { commanderCard: identity } : null;
      },
      (card) => {
        if (!addCard(state, card.n)) {
          showToast(`Deck Crafter holds up to ${PM_LIMITS.builderMaxCards} different cards.`);
          return;
        }
        refreshList();
      },
      (card) => `✓ ${card.n} added`,
    ),
  );
  window.scrollTo({ top: window.scrollY, behavior: "instant" });
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  const list = document.getElementById("dbDeckList")!;
  void list.offsetHeight;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (!list.isConnected) return;
      list.style.overflowY = "hidden";
      void list.offsetHeight;
      list.style.overflowY = "auto";
    }),
  );
  button("dbScanBtn", () => {
    state.player = input("dbPlayerInput").value;
    saveDraft(state);
    stopSearches();
    openCardScanner();
  });
  input("dbIdentityToggle").addEventListener("change", () => {
    state.filterByIdentity = input("dbIdentityToggle").checked;
    rerunSearch();
  });
  button("dbSaveBtn", () => {
    if (!Object.keys(state.cards).length) {
      showToast("Add at least one card first.");
      return;
    }
    if (!state.commander) {
      showToast("Set a commander before saving.");
      return;
    }
    if (!state.player) {
      showToast("Enter a player name before saving.");
      input("dbPlayerInput").focus();
      return;
    }
    const sameDeck =
      input("commanderInput").value.trim() === state.commander.trim() &&
      input("playerInput").value.trim() === state.player.trim();
    decklist().value = deckText(state);
    input("commanderInput").value = state.commander;
    input("playerInput").value = state.player;
    if (!sameDeck) ports.resetDeckName();
    clearDraft();
    stopSearches();
    closeTryADeckModal();
    ports.setSingleMode();
    ports.saveDeck();
  });
  button("dbChartBtn", () => {
    void chart();
  });
}

async function chart(): Promise<void> {
  if (!Object.keys(state.cards).length) {
    showToast("Add at least one card first.");
    return;
  }
  decklist().value = deckText(state);
  if (state.commander) input("commanderInput").value = state.commander;
  stopSearches();
  closeTryADeckModal();
  ports.setSingleMode();
  await ports.chart();
  document.getElementById("resultsSection")?.scrollIntoView({ behavior: "smooth" });
}

export function mount(dependencies: CrafterPorts): () => void {
  ports = dependencies;
  const unregister = registerDeckEditor({
    open: () => openDeckBuilderOverlay(),
    cards: () => state.cards,
    commander: () => state.commander,
    accepts: (card) =>
      !state.filterByIdentity || fitsIdentity(card, identityCard(state, ports.findCard)),
    update: (cards) => {
      state.cards = cards;
      saveDraft(state);
    },
  });
  const opener = document.getElementById("openDeckBuilderBtn");
  const open = () => openDeckBuilderOverlay();
  opener?.addEventListener("click", open);
  return () => {
    opener?.removeEventListener("click", open);
    stopSearches();
    unregister();
  };
}
