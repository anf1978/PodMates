// Temporary adapters to the still-inline card DB, deck form, mode switch, account guard, link
// check and display settings. Everything else comes from typed modules. No cloud shim access.
import { configureProfile, mount } from "./index";
import { configurePublicProfileRuntime } from "./public-runtime";
import { buildProfileTable, type ProfileTableRuntime } from "./table";
import { pageContext } from "../../engine/legacy-globals";
import { detectCommander } from "../../engine/commanders";
import type { ProfileRuntime } from "./runtime";
import type { CardRecord } from "../../cards/tuple";
import type { LookupIndexes } from "../../cards/lookup";
import { openTadOverlay, closeTryADeckModal } from "../../ui/tad-modal";
import { showActionConfirmModal, showConfirmModal } from "../../ui/confirm";
import { showDecksTable } from "../../ui/decks-table";
import { emit } from "../../services/events";
import { fetchCardImageUrl } from "../../services/card-art";
import { runChart } from "../../services/current-chart";
import { analyzeList, POD_COLORS } from "../../services/deck-analysis";
import { analyzeDeckRows } from "../../services/deck-rows";
import { dropLinkedDuplicates } from "../../services/linked-duplicates";
import { referenceSummary } from "../../services/reference-data";
import { loadSavedDecks, refreshSavedDecks } from "../../services/saved-decks";

declare const dbReady: boolean;
declare const CARD_DB: CardRecord[];
declare const indexes: LookupIndexes;
declare const safeHttpUrl: ProfileRuntime["safeUrl"];
declare const renderDisplaySettings: ProfileRuntime["displaySettings"];
declare const currentPodViewId: string | null;
declare const setMode: (mode: string) => void;
declare const requireAccountToSave: (what: string) => boolean;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- write-only classic-script binding
declare let deckNameManuallyEdited: boolean;

const analyzeOneList = (list: string, player: string, commander: string) =>
  analyzeList(list, player, commander, { context: pageContext(), indexes, detectCommander });

const table: ProfileTableRuntime = {
  ready: () => dbReady,
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
  ready: () => dbReady,
  context: pageContext,
  cards: () => CARD_DB,
  indexes: () => indexes,
  safeUrl: (raw) => safeHttpUrl(raw),
  buildTable: () => buildProfileTable(table),
  displaySettings: (area) => renderDisplaySettings(area),
  requireAccount: (what) => requireAccountToSave(what),
  priceScry: () => emit("pricescry:open", undefined),
  podId: () => currentPodViewId,
  chartDeck: async (deck) => {
    document.querySelector<HTMLTextAreaElement>("#decklistInput")!.value = deck.decklistText;
    if (deck.commander)
      document.querySelector<HTMLInputElement>("#commanderInput")!.value = deck.commander;
    const player = document.querySelector<HTMLInputElement>("#playerInput");
    if (deck.player && player) player.value = deck.player;
    const name = document.querySelector<HTMLInputElement>("#deckNameInput");
    if (name) {
      name.value = deck.name;
      deckNameManuallyEdited = true;
    }
    setMode("single");
    await runChart();
    document.getElementById("resultsSection")?.scrollIntoView({ behavior: "smooth" });
  },
});

configurePublicProfileRuntime({
  isDbReady: () => dbReady,
  getIndexes: () => indexes || null,
  loadSavedDecks: () => loadSavedDecks(),
  dropLinkedDuplicates: (decks) => dropLinkedDuplicates(decks),
  analyzeOneList: (list, player, commander) => analyzeOneList(list, player, commander),
  fetchCardImageUrl: (name, size) => fetchCardImageUrl(name, size),
  openTadOverlay: () => openTadOverlay(),
  closeTryADeckModal: () => closeTryADeckModal(),
  showActionConfirmModal: (message, label, confirm, cancel) =>
    showActionConfirmModal(message, label, confirm, cancel),
  chartDeck: (deck) => {
    document.querySelector<HTMLTextAreaElement>("#decklistInput")!.value = deck._rawList || "";
    const commander = document.querySelector<HTMLInputElement>("#commanderInput");
    const player = document.querySelector<HTMLInputElement>("#playerInput");
    const name = document.querySelector<HTMLInputElement>("#deckNameInput");
    if (commander) commander.value = deck._rawCommander || "";
    if (player) player.value = deck._ownerName || "";
    if (name) name.value = "";
    deckNameManuallyEdited = false;
    setMode("single");
    void runChart();
  },
  podColors: POD_COLORS,
});

mount();
