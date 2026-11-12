// What Saved Decks needs from the page that is not a typed module yet (the deck form's flags, the
// card DB gate and the shared analysis).
import type { AnalyzeDeck } from "../../services/deck-rows";

export interface SavedDecksPorts {
  /** True once the card database has loaded. */
  ready(): boolean;
  analyze: AnalyzeDeck;
  /** The account guard: false (and the sign-up prompt shown) when signed out. */
  requireAccount(what: string): boolean;
  /** Marks the deck form's Deck Name as chosen by hand, so auto-naming leaves it alone. */
  nameChosen(): void;
  /** The Archidekt/Moxfield link imported into the form, if any. */
  importedUrl(): string | null;
}

let current: SavedDecksPorts | undefined;
export function configure(ports: SavedDecksPorts): void {
  current = ports;
}
export function ports(): SavedDecksPorts {
  if (!current) throw new Error("Saved decks are not configured");
  return current;
}
