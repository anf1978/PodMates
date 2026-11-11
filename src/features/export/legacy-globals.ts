// TODO(p3-6): remove with the last inline Deck Chart analysis binding.
import { mount } from "./index";
import type { ExportDeck } from "./state";

declare const currentMatchedCards: ExportDeck["matched"] | null;
declare const currentCommanders: string[] | null;

const button = document.getElementById("exportDeckBtn");
if (button)
  mount(button, () =>
    currentMatchedCards && currentCommanders
      ? { matched: currentMatchedCards, commanders: currentCommanders }
      : null,
  );
