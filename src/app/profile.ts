// Supplies My Profile and the public profiles with the card data, deck form, mode switch, Display
// settings tray and account guard.
import { requireAccountToSave } from "../features/auth";
import { configureProfile, mount } from "../features/profile";
import { configurePublicProfileRuntime } from "../features/profile/public-runtime";
import { buildProfileTable, type ProfileTableRuntime } from "../features/profile/table";
import { mount as mountDisplaySettings } from "../features/themes";
import { cardDb, isDbReady, lookupIndexes, pageContext } from "../services/card-data";
import { fetchCardImageUrl } from "../services/card-art";
import { runChart } from "../services/current-chart";
import { POD_COLORS } from "../services/deck-analysis";
import { analyzeDeckRows } from "../services/deck-rows";
import { fillDeckForm, setDeckNameChosen } from "../services/deck-form";
import { emit } from "../services/events";
import { dropLinkedDuplicates } from "../services/linked-duplicates";
import { referenceSummary } from "../services/reference-data";
import { safeHttpUrl } from "../services/safe-url";
import { loadSavedDecks, refreshSavedDecks } from "../services/saved-decks";
import { showActionConfirmModal, showConfirmModal } from "../ui/confirm";
import { showDecksTable } from "../ui/decks-table";
import { closeTryADeckModal, openTadOverlay } from "../ui/tad-modal";
import { activePodId } from "./active-pod";
import { analyzeOneList } from "./analysis";
import { setMode } from "./mode";

const table: ProfileTableRuntime = {
  ready: isDbReady,
  refresh: async () => void (await refreshSavedDecks()),
  saved: () => loadSavedDecks(),
  deduplicate: (decks) => dropLinkedDuplicates(decks),
  analyze: (decks) => analyzeDeckRows(decks, analyzeOneList),
  display: (rows, area) => showDecksTable(area, rows, referenceSummary()),
};

configureProfile({
  open: (options) => openTadOverlay(options).modal,
  close: () => closeTryADeckModal(),
  confirm: (message, action) => showConfirmModal(message, action),
  ready: isDbReady,
  context: pageContext,
  cards: cardDb,
  indexes: lookupIndexes,
  safeUrl: (raw) => safeHttpUrl(raw),
  buildTable: () => buildProfileTable(table),
  displaySettings: (area) => mountDisplaySettings(area),
  requireAccount: (what) => requireAccountToSave(what),
  priceScry: () => emit("pricescry:open", undefined),
  podId: activePodId,
  chartDeck: async (deck) => {
    fillDeckForm({
      decklist: deck.decklistText,
      commander: deck.commander || undefined,
      player: deck.player || undefined,
      name: deck.name,
    });
    setDeckNameChosen(true);
    setMode("single");
    await runChart();
    document.getElementById("resultsSection")?.scrollIntoView({ behavior: "smooth" });
  },
});

configurePublicProfileRuntime({
  isDbReady,
  getIndexes: () => lookupIndexes() || null,
  loadSavedDecks: () => loadSavedDecks(),
  dropLinkedDuplicates: (decks) => dropLinkedDuplicates(decks),
  analyzeOneList: (list, player, commander) => analyzeOneList(list, player, commander),
  fetchCardImageUrl: (name, size) => fetchCardImageUrl(name, size),
  openTadOverlay: () => openTadOverlay(),
  closeTryADeckModal: () => closeTryADeckModal(),
  showActionConfirmModal: (message, label, confirm, cancel) =>
    showActionConfirmModal(message, label, confirm, cancel),
  chartDeck: (deck) => {
    fillDeckForm({
      decklist: deck._rawList || "",
      commander: deck._rawCommander || "",
      player: deck._ownerName || "",
      name: "",
    });
    setDeckNameChosen(false);
    setMode("single");
    void runChart();
  },
  podColors: POD_COLORS,
});

mount();
