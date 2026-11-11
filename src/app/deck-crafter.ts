// Supplies Deck Crafter's ports: card search and ranking, the form's name, Save and Chart.
import { mount } from "../features/deck-crafter";
import type { CrafterPorts } from "../features/deck-crafter/ports";
import {
  findPageCard,
  isDbReady,
  pageRankingsLoaded,
  searchPageCards,
} from "../services/card-data";
import { runChart } from "../services/current-chart";
import { resetDeckName } from "../services/deck-form";
import { emit } from "../services/events";
import { showActionConfirmModal } from "../ui/confirm";
import { setMode } from "./mode";

const ports: CrafterPorts = {
  ready: isDbReady,
  findCard: (name) => findPageCard(name),
  rankingsReady: pageRankingsLoaded,
  search: searchPageCards,
  confirm: (...args) => showActionConfirmModal(...args),
  resetDeckName,
  saveDeck: () => emit("decks:save", undefined),
  setSingleMode: () => setMode("single"),
  chart: () => runChart(),
};

mount(ports);
