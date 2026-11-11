// The Deck Chart form's shared state: whether Deck Name was typed by hand, and the deck link
// last imported into the form (for "keep synced" on Save). The form's own wiring is
// src/features/deck-form; other boundaries fill the form through fillDeckForm.
//
// Deck Name defaults to "Commander (Player)" and tracks live edits to either field -- right up
// until the person types into Deck Name themselves, at which point their custom name stops being
// overwritten. Clearing Deck Name back to empty resumes auto-naming.

let nameChosen = false;
let importedUrl: string | null = null;

const field = (id: string) =>
  document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;

export const deckNameChosen = (): boolean => nameChosen;

/** Deck Name now holds a name the person (or a loaded deck) chose; auto-naming stops. */
export function setDeckNameChosen(chosen: boolean): void {
  nameChosen = chosen;
}

export function autoFillDeckName(): void {
  if (nameChosen) return;
  const nameInput = field("deckNameInput");
  if (!nameInput) return;
  const cmd = (field("commanderInput")?.value || "").trim();
  const player = (field("playerInput")?.value || "").trim();
  nameInput.value = cmd || player ? `${cmd} (${player})` : "";
}

/** Resumes auto-naming and recomputes Deck Name from the commander and player. */
export function resetDeckName(): void {
  nameChosen = false;
  autoFillDeckName();
}

export const importedDeckUrl = (): string | null => importedUrl;

export function setImportedDeckUrl(url: string | null): void {
  importedUrl = url;
}

export interface DeckFormValues {
  decklist: string;
  commander?: string;
  player?: string;
  name?: string;
}

/** Fills the form; fields left undefined keep their value. Callers set the name flag themselves. */
export function fillDeckForm(values: DeckFormValues): void {
  const set = (id: string, value: string | undefined) => {
    const input = field(id);
    if (input && value !== undefined) input.value = value;
  };
  set("decklistInput", values.decklist);
  set("commanderInput", values.commander);
  set("playerInput", values.player);
  set("deckNameInput", values.name);
}
