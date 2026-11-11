// TODO(p3-6): remove this adapter when the page's shared ranking and save/chart orchestration move.
import { mount } from "./index";
import type { CrafterPorts, SearchOptions } from "./ports";
import type { CardRecord } from "../../cards/tuple";

declare const dbReady: boolean;
declare const indexes: { byExactName: Map<string, CardRecord> };
declare const TRY_A_DECK_OPTIONS: unknown;
declare function loadDeckLibrary(): Promise<void>;
declare function searchCardsByName(
  query: string,
  limit: number,
  options?: SearchOptions | null,
): CardRecord[];
declare function showActionConfirmModal(
  message: string,
  label: string,
  yes: () => void,
  no: () => void,
): void;
declare let deckNameManuallyEdited: boolean;
declare function autoFillDeckName(): void;
declare function saveCurrentDeck(): void;
declare function setMode(mode: string): void;
declare function runAnalysis(): Promise<void>;

const ports: CrafterPorts = {
  ready: () => dbReady,
  findCard: (name) => indexes.byExactName.get(name.toLowerCase()),
  rankingsReady: () => !!TRY_A_DECK_OPTIONS,
  search: async (query, limit, options) => {
    await loadDeckLibrary();
    return searchCardsByName(query, limit, options);
  },
  confirm: (...args) => showActionConfirmModal(...args),
  resetDeckName: () => {
    if (deckNameManuallyEdited) deckNameManuallyEdited = false;
    autoFillDeckName();
  },
  saveDeck: () => saveCurrentDeck(),
  setSingleMode: () => setMode("single"),
  chart: () => runAnalysis(),
};

mount(ports);
