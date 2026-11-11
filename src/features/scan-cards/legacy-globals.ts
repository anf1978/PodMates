// TODO(p3-6): remove when the remaining inline card-database bindings move.
import { mount } from "./index";
import { addScannedCards } from "./state";
import { parseDecklist } from "../../cards/parse-decklist";
import { fuzzyFindCard, type LookupIndexes } from "../../cards/lookup";
import type { CardRecord } from "../../cards/tuple";
import { PM_LIMITS } from "../../services/cloud/limits";
import { deckEditor, registerCardScanner } from "../../services/deck-editing";

declare const CARD_DB: CardRecord[];
declare const indexes: LookupIndexes;

const input = document.getElementById("scanCardsFileInput") as HTMLInputElement | null;
const scanner = input
  ? mount(input, {
      cards: () => CARD_DB,
      indexes: () => indexes,
      inDeck() {
        const names = new Set(Object.keys(deckEditor().cards()));
        const textarea = document.getElementById("decklistInput") as HTMLTextAreaElement | null;
        for (const entry of parseDecklist(textarea?.value || "").entries) {
          const match = fuzzyFindCard(entry.name, CARD_DB, indexes);
          if (match) names.add(match.card.n);
        }
        return names;
      },
      returnToBuilder: () => deckEditor().open(),
      add(cards) {
        const editor = deckEditor();
        const added = addScannedCards(cards, editor.cards(), editor.accepts, PM_LIMITS);
        editor.update(added.cards);
        return { ...added, commander: editor.commander() };
      },
    })
  : null;

if (scanner) registerCardScanner(() => scanner.open());
