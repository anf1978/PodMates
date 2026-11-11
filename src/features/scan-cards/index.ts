// Scanner lifecycle and asynchronous photo runs; all Deck Crafter access is injected.
import "./scan-cards.css";
import type { CardRecord } from "../../cards/tuple";
import type { LookupIndexes } from "../../cards/lookup";
import { render } from "../../ui/html";
import { closeModal } from "../../ui/modal";
import { openTadOverlay } from "../../ui/tad-modal";
import { showToast } from "../../ui/toast";
import { reportError } from "../../services/report-error";
import { matchPhotoText, sortedNames, type ScanResult, type AddedCards } from "./state";
import { readPhoto } from "./ocr";
import { resultsTemplate, scanTemplate } from "./view";

export interface ScanOptions {
  cards(): readonly CardRecord[];
  indexes(): LookupIndexes;
  inDeck(): ReadonlySet<string>;
  returnToBuilder(): void;
  add(cards: CardRecord[]): AddedCards & { commander: string | null };
  readPhoto?: (file: Blob) => Promise<string>;
}

export interface Scanner {
  open(): void;
  destroy(): void;
}

export function mount(input: HTMLInputElement, options: ScanOptions): Scanner {
  let lastFiles: File[] = [];
  let results: ScanResult[] = [];
  let modal: HTMLElement | undefined;
  let overlay: HTMLElement | undefined;
  let generation = 0;
  let cachedCards: readonly CardRecord[] | undefined;
  let names: ReturnType<typeof sortedNames> = [];

  function displayResults(): void {
    const area = modal?.querySelector<HTMLElement>("#scanCardsResultsArea");
    if (!area) return;
    render(
      resultsTemplate(results, (index, checked) => {
        results = results.map((result, i) => (i === index ? { ...result, checked } : result));
      }),
      area,
    );
    const actions = modal?.querySelector<HTMLElement>("#scanCardsActionRow");
    if (actions) actions.hidden = !results.length;
  }

  async function run(files: File[]): Promise<void> {
    if (!files.length || !modal || !overlay) return;
    lastFiles = files;
    const runId = ++generation;
    const currentOverlay = overlay;
    const active = () => runId === generation && currentOverlay.isConnected;
    const status = modal.querySelector("#scanCardsStatus");
    const rescan = modal.querySelector<HTMLButtonElement>("#scanCardsRescanBtn");
    if (rescan) rescan.disabled = false;
    let failures = 0;
    let lastFailure = "";
    for (const [index, file] of files.entries()) {
      if (!active()) return;
      if (status) status.textContent = `Reading photo ${index + 1} of ${files.length}…`;
      try {
        const text = await (options.readPhoto ?? readPhoto)(file);
        if (!active()) return;
        const cards = options.cards();
        if (cards !== cachedCards) {
          cachedCards = cards;
          names = sortedNames(cards);
        }
        results = matchPhotoText(
          text,
          names,
          options.indexes().byExactName,
          results,
          options.inDeck(),
        );
      } catch (error) {
        reportError(error, { operation: "card-scan" });
        if (!active()) return;
        failures++;
        lastFailure = `Could not read that photo: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    if (!active()) return;
    if (status)
      status.textContent = failures
        ? lastFailure
        : `Done — found ${results.length} new card(s) across ${files.length} photo(s) (anything already found or already in your decklist is skipped automatically). Review below.`;
    displayResults();
  }

  function add(): void {
    const chosen = [
      ...new Set(results.filter((result) => result.checked).map((result) => result.card)),
    ];
    if (!chosen.length) return;
    const { added, offColour, full, commander } = options.add(chosen);
    options.returnToBuilder();
    let message = `Added ${added} scanned card${added === 1 ? "" : "s"} to your deck.`;
    if (offColour) message += ` ${offColour} skipped (outside ${commander}'s colours).`;
    if (full) message += ` ${full} skipped (deck is full).`;
    showToast(message);
  }

  const selected = () => {
    const files = Array.from(input.files ?? []);
    input.value = "";
    void run(files);
  };
  input.addEventListener("change", selected);
  return {
    open() {
      generation++;
      results = [];
      const layer = openTadOverlay({ onDismiss: () => options.returnToBuilder() });
      modal = layer.modal;
      overlay = layer.overlay;
      render(
        scanTemplate(
          {
            close: () => options.returnToBuilder(),
            photo: () => input.click(),
            rescan: () => {
              void run(lastFiles);
            },
            add,
          },
          !!lastFiles.length,
        ),
        modal,
      );
    },
    destroy() {
      generation++;
      input.removeEventListener("change", selected);
      closeModal(overlay);
      lastFiles = [];
      results = [];
    },
  };
}
