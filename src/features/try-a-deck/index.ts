// Public lifecycle: loading/navigation are local; callers supply data and the deck-form handoff.
import "./try-a-deck.css";
import { render } from "../../ui/html";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import { reportError } from "../../services/report-error";
import { back, initialNavigation, navigate, type SampleDeck } from "./state";
import { libraryTemplate, loadingTemplate, type Actions } from "./view";

export interface TryADeckOptions {
  load(): Promise<readonly SampleDeck[]>;
  select(deck: SampleDeck): void;
}

export async function showTryADeck(options: TryADeckOptions): Promise<void> {
  const { modal, overlay } = openTadOverlay({ modalId: "tadModal" });
  let state = initialNavigation();
  render(loadingTemplate(closeTryADeckModal), modal);
  let decks: readonly SampleDeck[];
  try {
    decks = await options.load();
  } catch (error) {
    reportError(error, { operation: "deck-library" });
    if (overlay.isConnected) {
      render(
        loadingTemplate(
          closeTryADeckModal,
          `Could not load the deck library: ${error instanceof Error ? error.message : String(error)}`,
        ),
        modal,
      );
    }
    return;
  }
  if (!overlay.isConnected) return;
  const update = () => render(libraryTemplate(decks, state.current, actions), modal);
  const actions: Actions = {
    close: closeTryADeckModal,
    back: () => {
      state = back(state);
      update();
    },
    navigate: (location) => {
      state = navigate(state, location);
      update();
    },
    select: (deck) => {
      options.select(deck);
      closeTryADeckModal();
    },
  };
  update();
}

export function mount(button: HTMLElement, options: TryADeckOptions): () => void {
  const open = () => {
    void showTryADeck(options);
  };
  button.addEventListener("click", open);
  return () => {
    button.removeEventListener("click", open);
  };
}
