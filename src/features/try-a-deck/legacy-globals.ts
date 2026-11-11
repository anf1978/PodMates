// TODO(p3-6): remove this adapter when the deck form and shared library gate are typed.
import { mount } from "./index";
import type { SampleDeck } from "./state";

declare function loadDeckLibrary(): Promise<void>;
declare const TRY_A_DECK_OPTIONS: SampleDeck[];
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- write-only classic-script binding
declare let deckNameManuallyEdited: boolean;

const button = document.getElementById("sampleBtn");
if (button)
  mount(button, {
    async load() {
      await loadDeckLibrary();
      return TRY_A_DECK_OPTIONS;
    },
    select(deck) {
      const input = (id: string) =>
        document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
      const decklist = input("decklistInput");
      if (decklist) decklist.value = deck.decklist;
      const commander = input("commanderInput");
      if (commander) commander.value = deck.commander;
      for (const id of ["playerInput", "deckNameInput"]) {
        const field = input(id);
        if (field) field.value = "";
      }
      deckNameManuallyEdited = false;
      const chart = document.getElementById("chartBtn");
      chart?.classList.add("tad-pulsing");
      chart?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    },
  });
