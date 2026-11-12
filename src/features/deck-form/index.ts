// The Deck Chart form's own controls: Clear, Deck Name auto-naming and the Archidekt/Moxfield
// deck-link import. Shared form state (chosen name, imported link) is src/services/deck-form.ts.
import { fetchDeckByLink } from "../../services/cloud/linked-decks";
import { autoFillDeckName, setDeckNameChosen, setImportedDeckUrl } from "../../services/deck-form";
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
  const sync = byId<HTMLElement>("deckLinkSyncOption");
  if (sync) sync.style.display = "none";
  setStatusText(byId("status"), "");
  setStatusText(byId("deckMgmtStatus"), "");
  byId<HTMLElement>("notFoundBox")!.replaceChildren();
  byId<HTMLElement>("resultsSection")!.style.display = "none";
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
  const platform = d.platform
    ? d.platform.charAt(0).toUpperCase() + d.platform.slice(1)
    : "the source";
  byId<HTMLElement>("deckLinkSyncPlatform")!.textContent = platform;
  byId("deckLinkSyncCheckbox")!.checked = false;
  byId<HTMLElement>("deckLinkSyncOption")!.style.display = "";
}

export function mount(): void {
  byId("clearBtn")!.addEventListener("click", clearForm);
  byId("commanderInput")?.addEventListener("input", autoFillDeckName);
  byId("playerInput")?.addEventListener("input", autoFillDeckName);
  const name = byId("deckNameInput");
  name?.addEventListener("input", () => setDeckNameChosen(name.value.trim().length > 0));
  const importButton = byId<HTMLButtonElement>("deckLinkLoadBtn");
  importButton?.addEventListener("click", () => void importDeckLink(importButton));
}
