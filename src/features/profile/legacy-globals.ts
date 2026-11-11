// Temporary adapters to unmoved chart/table/display/backup callers. No cloud shim access.
import { configureProfile, mount } from "./index";
import { configurePublicProfileRuntime, type PublicProfileRuntime } from "./public-runtime";
import { openPlayerProfileOverlay, openPodProfileOverlay } from "./public-view";
import type { PublicProfileDeck } from "./public-types";
import { buildProfileTable, type ProfileTableRuntime } from "./table";
import { pageContext } from "../../engine/legacy-globals";
import type { ProfileRuntime } from "./runtime";
import type { SavedDeck } from "../../services/cloud/types";
import type { CardRecord } from "../../cards/tuple";
import type { LookupIndexes } from "../../cards/lookup";
import { openTadOverlay, closeTryADeckModal } from "../../ui/tad-modal";

declare const showConfirmModal: ProfileRuntime["confirm"];
declare const dbReady: boolean;
declare const CARD_DB: CardRecord[];
declare const indexes: LookupIndexes;
declare const safeHttpUrl: ProfileRuntime["safeUrl"];
declare const renderDisplaySettings: ProfileRuntime["displaySettings"];
declare const downloadMyDataBackup: ProfileRuntime["downloadBackup"];
declare const restoreMyDataBackup: ProfileRuntime["restoreBackup"];
declare const requestPriceScryAccess: ProfileRuntime["priceScry"];
declare const currentPodViewId: string | null;
declare const refreshCloudDecksCache: () => Promise<void>;
declare const loadSavedDecks: () => Record<string, SavedDeck>;
declare const pmDropLinkedDuplicates: <T extends PublicProfileDeck>(decks: T[]) => T[];
declare const pmAnalyzeDeckRows: ProfileTableRuntime["analyze"];
declare const PM_TABLES: Record<
  string,
  { rows: unknown[]; chain: unknown; touched: boolean; area: HTMLElement }
>;
declare const PM_TABLE_DEFAULT_CHAIN: () => unknown;
declare const pmRenderDecksTable: (id: string) => void;
declare const setMode: (mode: string) => void;
declare const runAnalysis: () => Promise<void>;
declare const analyzeOneList: PublicProfileRuntime["analyzeOneList"];
declare const fetchCardImageUrl: PublicProfileRuntime["fetchCardImageUrl"];
declare const POD_COLORS: readonly string[];
declare const showActionConfirmModal: PublicProfileRuntime["showActionConfirmModal"];

const table: ProfileTableRuntime = {
  ready: () => dbReady,
  refresh: () => refreshCloudDecksCache(),
  saved: () => loadSavedDecks(),
  deduplicate: (decks) => pmDropLinkedDuplicates(decks),
  analyze: (decks) => pmAnalyzeDeckRows(decks),
  display: (rows, area) => {
    PM_TABLES.mine = { rows, chain: PM_TABLE_DEFAULT_CHAIN(), touched: false, area };
    pmRenderDecksTable("mine");
  },
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
  downloadBackup: () => downloadMyDataBackup(),
  restoreBackup: (text) => restoreMyDataBackup(text),
  priceScry: () => requestPriceScryAccess(),
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
    await runAnalysis();
    document.getElementById("resultsSection")?.scrollIntoView({ behavior: "smooth" });
  },
});

configurePublicProfileRuntime({
  isDbReady: () => dbReady,
  getIndexes: () => indexes || null,
  loadSavedDecks: () => loadSavedDecks(),
  dropLinkedDuplicates: (decks) => pmDropLinkedDuplicates(decks),
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
    void runAnalysis();
  },
  podColors: POD_COLORS,
});

const legacy = {
  // TODO(p3-6): pod member lists still open player profiles.
  openPlayerProfileOverlay,
  // TODO(p3-6): pod navigation still opens the pod profile.
  openPodProfileOverlay,
};
type ProfileLegacy = typeof legacy;
declare global {
  let deckNameManuallyEdited: boolean;
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends ProfileLegacy {}
}
Object.assign(window, legacy);
mount();
