import type { LookupIndexes } from "../../cards/lookup.ts";
import type { PublicProfileAnalysis, PublicProfileDeck } from "./public-types.ts";

/** Capabilities still owned by the page; no profile code reads legacy globals. */
export interface PublicProfileRuntime {
  isDbReady(): boolean;
  getIndexes(): LookupIndexes | null;
  loadSavedDecks(): Record<string, PublicProfileDeck>;
  dropLinkedDuplicates(decks: PublicProfileDeck[]): PublicProfileDeck[];
  analyzeOneList(list: string, player: string, commander: string): PublicProfileAnalysis | null;
  fetchCardImageUrl(name: string, size: "normal"): Promise<string | null>;
  openTadOverlay(): { modal: HTMLElement };
  closeTryADeckModal(): void;
  showActionConfirmModal(
    message: string,
    confirmLabel: string,
    onConfirm: () => void,
    onCancel: () => void,
  ): void;
  /** Fill the deck form, reset its manual-name flag, select single mode and analyze. */
  chartDeck(deck: PublicProfileAnalysis): void;
  podColors: readonly string[];
}

let runtime: PublicProfileRuntime | undefined;

export function configurePublicProfileRuntime(value: PublicProfileRuntime): void {
  runtime = value;
}

export function publicProfileRuntime(): PublicProfileRuntime {
  if (!runtime) throw new Error("Public profile runtime is not configured");
  return runtime;
}
