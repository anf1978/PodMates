// TODO(p3-6): remove this adapter when the page's shared ranking and save/chart orchestration move.
import { mount } from "./index";
import type { CrafterPorts } from "./ports";
import { findPageCard, pageRankingsLoaded, searchPageCards } from "../../cards/legacy-globals";
import { showActionConfirmModal } from "../../ui/confirm";
import { runChart } from "../../services/current-chart";
import { emit } from "../../services/events";

declare const dbReady: boolean;
declare let deckNameManuallyEdited: boolean;
declare function autoFillDeckName(): void;
declare function setMode(mode: string): void;

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
  saveDeck: () => emit("decks:save", undefined),
  setSingleMode: () => setMode("single"),
  chart: () => runChart(),
};

mount(ports);
