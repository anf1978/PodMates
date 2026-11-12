// Binds Scan Cards to the card DB and Deck Crafter's editor (src/services/deck-editing.ts).
import { fuzzyFindCard } from "../cards/lookup";
import { parseDecklist } from "../cards/parse-decklist";
import { mount } from "../features/scan-cards";
import { addScannedCards } from "../features/scan-cards/state";
import { cardDb, lookupIndexes } from "../services/card-data";
import { PM_LIMITS } from "../services/cloud/limits";
import { deckEditor, registerCardScanner } from "../services/deck-editing";

const input = document.getElementById("scanCardsFileInput") as HTMLInputElement | null;
const scanner = input
  ? mount(input, {
      cards: cardDb,
      indexes: lookupIndexes,
      inDeck() {
        const names = new Set(Object.keys(deckEditor().cards()));
        const textarea = document.getElementById("decklistInput") as HTMLTextAreaElement | null;
        for (const entry of parseDecklist(textarea?.value || "").entries) {
          const match = fuzzyFindCard(entry.name, cardDb(), lookupIndexes());
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
