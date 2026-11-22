// The Deck Chart form's own controls: Clear (with a warning before losing an unsaved deck), Deck Name auto-naming and the Archidekt/Moxfield
// deck-link import. Shared form state (chosen name, imported link) is src/services/deck-form.ts.
import { fetchDeckByLink } from "../../services/cloud/linked-decks";
import {
  autoFillDeckName,
  chartedDeck,
  sampleInForm,
  setChartedDeck,
  setDeckNameChosen,
  setImportedDeckUrl,
  setSampleInForm,
} from "../../services/deck-form";
import { showActionConfirmModal } from "../../ui/confirm";
import { setStatusText } from "../../ui/status";

const byId = <T extends HTMLElement = HTMLInputElement>(id: string) =>
  document.getElementById(id) as T | null;

function clearForm(): void {
  for (const id of ["decklistInput", "commanderInput", "playerInput", "deckNameInput"]) {
    const input = byId(id);
    if (input) input.value = "";
  }
  setDeckNameChosen(false);
  setImportedDeckUrl(null);
  setChartedDeck(null);
  setSampleInForm(false);
  const sync = byId<HTMLElement>("deckLinkSyncOption");
  if (sync) sync.style.display = "none";
  setStatusText(byId("status"), "");
  setStatusText(byId("deckMgmtStatus"), "");
  byId<HTMLElement>("notFoundBox")!.replaceChildren();
  byId<HTMLElement>("resultsSection")!.style.display = "none";
}

/** A decklist that would be lost: one in the form that isn't a saved deck (as loaded or just saved)
 * or an untouched Try a Deck precon. */
export function unsavedDeckInForm(): boolean {
  const list = byId<HTMLTextAreaElement>("decklistInput")?.value.trim() ?? "";
  return list.length > 0 && !chartedDeck() && !sampleInForm();
}

/** Clear asks first when it would throw away a deck that hasn't been saved. */
export function requestClear(): void {
  if (!unsavedDeckInForm()) {
    clearForm();
    return;
  }
  showActionConfirmModal(
    "This deck hasn't been saved. Clear it anyway? It can't be brought back.",
    "Clear anyway",
    clearForm,
    null,
    "Keep it",
  );
}

async function importDeckLink(button: HTMLButtonElement): Promise<void> {
  const input = byId("deckLinkInput")!;
  const status = byId<HTMLElement>("deckLinkStatus")!;
  const url = (input.value || "").trim();
  if (!url) {
    status.textContent = "Paste an Archidekt or Moxfield deck link first.";
    status.className = "status err";
    return;
  }
  button.disabled = true;
  button.textContent = "Importing…";
  status.textContent = "";
  byId<HTMLElement>("deckLinkSyncOption")!.style.display = "none";
  setImportedDeckUrl(null);

  const result = await fetchDeckByLink(url);

  button.disabled = false;
  button.textContent = "Import Deck";
  if (!result.ok) {
    status.textContent = result.error;
    status.className = "status err";
    return;
  }

  const d = result.deck;
  byId<HTMLTextAreaElement>("decklistInput")!.value = d.decklistText as string;
  if (d.commander) byId("commanderInput")!.value = d.commander;
  // The platform's own deck name is usually more meaningful than the generic Commander (Player)
  // default, and matches the name this deck keeps if "keep synced" is used.
  const name = byId("deckNameInput");
  if (name) {
    name.value = d.name as string;
    setDeckNameChosen(true);
  }
  status.textContent = `Loaded “${d.name}” — ${d.cardCount} cards${d.commander ? `, commander: ${d.commander}` : " (commander not auto-detected — enter it above if needed)"}.`;
  status.className = "status";

  setImportedDeckUrl(url);
  // An imported list is a new, unsaved deck (not the saved deck or precon the form held before).
  setChartedDeck(null);
  setSampleInForm(false);
  const platform = d.platform
    ? d.platform.charAt(0).toUpperCase() + d.platform.slice(1)
    : "the source";
  byId<HTMLElement>("deckLinkSyncPlatform")!.textContent = platform;
  byId("deckLinkSyncCheckbox")!.checked = false;
  byId<HTMLElement>("deckLinkSyncOption")!.style.display = "";
}

export function mount(): void {
  byId("clearBtn")!.addEventListener("click", requestClear);
  // Typing into the list or commander makes it a different deck from the saved one (Deck Log) and
  // from the precon it started as.
  for (const id of ["decklistInput", "commanderInput"])
    byId(id)?.addEventListener("input", () => {
      setChartedDeck(null);
      setSampleInForm(false);
    });
  byId("commanderInput")?.addEventListener("input", autoFillDeckName);
  byId("playerInput")?.addEventListener("input", autoFillDeckName);
  const name = byId("deckNameInput");
  name?.addEventListener("input", () => setDeckNameChosen(name.value.trim().length > 0));
  const importButton = byId<HTMLButtonElement>("deckLinkLoadBtn");
  importButton?.addEventListener("click", () => void importDeckLink(importButton));
}
