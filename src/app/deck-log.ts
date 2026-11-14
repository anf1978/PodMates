// Binds the Deck Log panel under Structure & Legality, and gives the Deck Log's change entries the
// page's Command Spark for a decklist (null until the card database is ready).
import { mount } from "../features/deck-log";
import { isDbReady } from "../services/card-data";
import { configureDeckLog } from "../services/cloud/deck-log";
import { analyzeOneList } from "./analysis";

configureDeckLog({
  sparkOf(list, commander) {
    if (!isDbReady()) return null;
    return analyzeOneList(list, "", commander)?.commandSpark ?? null;
  },
});

const panel = document.getElementById("deckLogPanel");
if (panel) mount(panel);
