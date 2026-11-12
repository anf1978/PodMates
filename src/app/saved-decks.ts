// Supplies Saved Decks with the card-DB gate, analysis, account guard and the deck form's state.
import { requireAccountToSave } from "../features/auth";
import { mount } from "../features/saved-decks";
import { isDbReady } from "../services/card-data";
import { importedDeckUrl, setDeckNameChosen } from "../services/deck-form";
import { analyzeOneList } from "./analysis";

mount({
  ready: isDbReady,
  analyze: (raw, player, commander) => analyzeOneList(raw, player, commander),
  requireAccount: (what) => requireAccountToSave(what),
  nameChosen: () => setDeckNameChosen(true),
  importedUrl: importedDeckUrl,
});
