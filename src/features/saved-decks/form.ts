// The Deck Chart form fields Saved Decks reads and fills (static markup in index.html).
import { setStatusText } from "../../ui/status";

export const field = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

/** The status line under the save/load buttons. */
export function setDeckStatus(message: string, isError?: boolean): void {
  setStatusText(field("deckMgmtStatus"), message, isError);
}
