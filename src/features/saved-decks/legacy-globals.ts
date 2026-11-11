// Temporary ports to the still-inline deck form flags, card-DB gate, analysis inputs and account
// guard. Publishes nothing on window.
import { mount } from "./index";
import type { LookupIndexes } from "../../cards/lookup";
import { pageContext } from "../../engine/legacy-globals";
import { detectCommander } from "../../engine/commanders";
import { analyzeList } from "../../services/deck-analysis";

declare const dbReady: boolean;
declare const indexes: LookupIndexes;
declare const requireAccountToSave: (what: string) => boolean;
declare const lastImportedDeckUrl: string | null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- write-only classic-script binding
declare let deckNameManuallyEdited: boolean;

mount({
  ready: () => dbReady,
  analyze: (raw, player, commander) =>
    analyzeList(raw, player, commander, { context: pageContext(), indexes, detectCommander }),
  requireAccount: (what) => requireAccountToSave(what),
  nameChosen: () => {
    deckNameManuallyEdited = true;
  },
  importedUrl: () => lastImportedDeckUrl,
});
