// Binds Try-a-Deck to the deck library and the Deck Chart form.
import { mount } from "../features/try-a-deck";
import type { SampleDeck } from "../features/try-a-deck/state";
import { deckLibrary, loadDeckLibrary } from "../services/card-data";
import { fillDeckForm, setDeckNameChosen, setSampleInForm } from "../services/deck-form";
import { emit } from "../services/events";

const button = document.getElementById("sampleBtn");
if (button)
  mount(button, {
    async load() {
      await loadDeckLibrary();
      return deckLibrary() as unknown as SampleDeck[];
    },
    select(deck) {
      fillDeckForm({ decklist: deck.decklist, commander: deck.commander, player: "", name: "" });
      setDeckNameChosen(false);
      setSampleInForm(true);
      emit("samples:chosen", { key: String((deck as { key?: unknown }).key ?? "") });
      const chart = document.getElementById("chartBtn");
      chart?.classList.add("tad-pulsing");
      chart?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    },
  });
