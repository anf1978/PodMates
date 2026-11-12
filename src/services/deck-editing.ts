// Typed scan/crafter handoff, without feature imports or page globals.
import type { CardRecord } from "../cards/tuple";

export interface DeckEditor {
  open(): void;
  cards(): Record<string, number>;
  commander(): string | null;
  accepts(card: CardRecord): boolean;
  update(cards: Record<string, number>): void;
}

let editor: DeckEditor | undefined;
let scanner: (() => void) | undefined;

export function registerDeckEditor(next: DeckEditor): () => void {
  editor = next;
  return () => {
    if (editor === next) editor = undefined;
  };
}

export function deckEditor(): DeckEditor {
  if (!editor) throw new Error("Deck Crafter is not mounted");
  return editor;
}

export function registerCardScanner(open: () => void): () => void {
  scanner = open;
  return () => {
    if (scanner === open) scanner = undefined;
  };
}

export function openCardScanner(): void {
  if (!scanner) throw new Error("Card scanner is not mounted");
  scanner();
}
