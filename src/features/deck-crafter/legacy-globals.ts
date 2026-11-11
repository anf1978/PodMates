// TODO(p3-6): remove this adapter when the page's shared ranking and save/chart orchestration move.
import { mount } from "./index";
import type { CrafterPorts } from "./ports";
import { findPageCard, pageRankingsLoaded, searchPageCards } from "../../cards/legacy-globals";

declare const dbReady: boolean;
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
  findCard: (name) => findPageCard(name),
  rankingsReady: pageRankingsLoaded,
  search: searchPageCards,
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
