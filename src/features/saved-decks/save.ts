// Save Deck: the form's decklist to this account, with the name-collision choice.
import { action } from "../../services/cloud/operations";
import { saveDeck } from "../../services/cloud/decks";
import { addLinkedDeck } from "../../services/cloud/linked-decks";
import { uniqueDeckName } from "../../services/cloud/shared";
import { decklistProblem } from "../../services/decklist-limits";
import { loadSavedDecks, refreshSavedDecks } from "../../services/saved-decks";
import { html, render } from "../../ui/html";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import { ports } from "./ports";
import { field, setDeckStatus } from "./form";

const cloud = { saveDeck: action(saveDeck), addLinkedDeck: action(addLinkedDeck) };

// The actual write, shared by the plain save and both branches of the name-collision choice.
function performDeckSave(
  name: string,
  raw: string,
  cmd: string,
  player: string,
  existingKeyToReuse: string | null,
): void {
  const secretBox = field<HTMLInputElement>("deckSecretCheckbox");
  const entry = {
    list: raw,
    commander: cmd,
    player: player,
    deckName: name,
    savedAt: Date.now(),
    secret: !!(secretBox && secretBox.checked),
  };
  setDeckStatus("Saving…");
  cloud
    .saveDeck(name, entry, existingKeyToReuse ?? undefined)
    .then(async () => {
      await refreshSavedDecks();
      setDeckStatus(`Saved "${name}" to your account.`);
    })
    .catch((e: Error) => setDeckStatus("Could not save: " + e.message, true));
}

function saveLinked(url: string): void {
  setDeckStatus("Linking…");
  cloud
    .addLinkedDeck(url)
    .then(async (result) => {
      if (!result.ok) {
        setDeckStatus("Could not link: " + result.error, true);
        return;
      }
      await refreshSavedDecks();
      setDeckStatus(
        result.renamed
          ? `Saved and linked as "${result.deck.name}" — you already had a deck by that name, so this one got a distinguishing suffix.`
          : `Saved and linked as "${result.deck.name}" — it'll stay synced going forward.`,
      );
    })
    .catch((e: Error) => setDeckStatus("Could not link: " + e.message, true));
}

function askOverwrite(proposedName: string, onOverwrite: () => void, onSaveNew: () => void): void {
  const { modal } = openTadOverlay();
  render(
    html`<button class="tad-close" id="tadCloseBtn" @click=${closeTryADeckModal}>Close ×</button>
      <h2 class="saved-decks-title">Deck name already in use</h2>
      <p class="tad-sub">
        ${`A deck named "${proposedName}" already exists. Overwrite it, or save this as a separate, new deck?`}
      </p>
      <div class="row saved-decks-choice">
        <button
          id="dnOverwriteBtn"
          class="ghost"
          @click=${() => {
            closeTryADeckModal();
            onOverwrite();
          }}
        >
          Overwrite Existing
        </button>
        <button
          id="dnSaveNewBtn"
          @click=${() => {
            closeTryADeckModal();
            onSaveNew();
          }}
        >
          Save as New Deck
        </button>
      </div>`,
    modal,
  );
}

export function saveCurrentDeck(): void {
  const raw = field<HTMLTextAreaElement>("decklistInput")!.value.trim();
  if (!raw) {
    setDeckStatus("Paste a decklist before saving.", true);
    return;
  }
  const rawSizeProblem = decklistProblem(raw);
  if (rawSizeProblem) {
    setDeckStatus(rawSizeProblem, true);
    return;
  }
  const commanderInput = field<HTMLInputElement>("commanderInput");
  const cmd = (commanderInput?.value || "").trim();
  if (!cmd) {
    setDeckStatus("Commander is required to save. Enter the commander name above.", true);
    commanderInput?.focus();
    return;
  }
  const playerInput = field<HTMLInputElement>("playerInput");
  const player = (playerInput?.value || "").trim();
  if (!player) {
    setDeckStatus(
      "Player name is required to save — two decks sharing a commander would otherwise silently overwrite each other.",
      true,
    );
    playerInput?.focus();
    return;
  }
  if (!ports().requireAccount("decks")) return;

  // "Keep synced" takes over the whole save: linking already writes its own mirror into the same
  // decks collection, so doing both would recreate the duplicate-deck problem naming prevents.
  const syncCheckbox = field<HTMLInputElement>("deckLinkSyncCheckbox");
  const importedUrl = ports().importedUrl();
  if (syncCheckbox && syncCheckbox.checked && importedUrl) {
    saveLinked(importedUrl);
    return;
  }

  const nameInput = field<HTMLInputElement>("deckNameInput");
  const proposedName = (nameInput && nameInput.value.trim()) || `${cmd} (${player})`;

  // Every saved deck needs a name unique among THIS account's own decks (podmates' decks live in
  // their own namespace). Legacy decks without an explicit deckName use their old key instead.
  const decks = loadSavedDecks();
  const nameOf = (key: string, entry: unknown) =>
    (typeof entry === "object" && (entry as { deckName?: string }).deckName) || key;
  const matchedKey = Object.entries(decks).find(([k, e]) => nameOf(k, e) === proposedName)?.[0];

  if (!matchedKey) {
    performDeckSave(proposedName, raw, cmd, player, null);
    return;
  }
  askOverwrite(
    proposedName,
    () => performDeckSave(proposedName, raw, cmd, player, matchedKey),
    () => {
      const existingNames = new Set(Object.entries(decks).map(([k, e]) => nameOf(k, e)));
      const uniqueName = uniqueDeckName(proposedName, existingNames);
      if (nameInput) {
        nameInput.value = uniqueName;
        ports().nameChosen();
      }
      performDeckSave(uniqueName, raw, cmd, player, null);
    },
  );
}
