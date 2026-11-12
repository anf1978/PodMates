// My Data: download/restore a backup of personally-saved decks. Scoped to Saved Decks only, on
// purpose: linked (Archidekt/Moxfield) decks always have a live source on those sites, while a
// manually typed decklist exists nowhere else.
import { PM_LIMITS } from "../../services/cloud/limits";
import { loadSavedDecks, mergeSavedDecks, refreshSavedDecks } from "../../services/saved-decks";
import type { DeckInput } from "../../services/cloud/types";

function status(text: string, isError: boolean): void {
  const el = document.getElementById("profileDataStatus");
  if (!el) return;
  el.textContent = text;
  el.className = isError ? "status err" : "status";
}

export function buildMyDataBackup(): { json: string; deckCount: number } | null {
  const decks = loadSavedDecks();
  const deckCount = Object.keys(decks).length;
  if (deckCount === 0) return null;
  const payload = { type: "podmates_backup", version: 1, exportedAt: Date.now(), decks };
  return { json: JSON.stringify(payload, null, 2), deckCount };
}

export function downloadMyDataBackup(): void {
  const built = buildMyDataBackup();
  if (!built) {
    status("Nothing to back up yet -- save a deck first.", true);
    return;
  }
  try {
    const blob = new Blob([built.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `podmates-backup-${dateStr}.json`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    status(
      `Downloaded ${filename} (${built.deckCount} deck${built.deckCount === 1 ? "" : "s"}).`,
      false,
    );
  } catch (e) {
    status("Download didn't work in this browser: " + (e as Error).message, true);
  }
}

type DeckMap = Record<string, DeckInput | string>;

// The proper envelope, or a raw {key: entry, ...} map from an older-format export.
function looksLikeDeckMap(obj: unknown): obj is DeckMap {
  return (
    !!obj &&
    typeof obj === "object" &&
    Object.values(obj).some(
      (v) => v && typeof v === "object" && typeof v.list === "string" && v.list.length > 0,
    )
  );
}

export async function restoreMyDataBackup(
  jsonText: string,
  requireAccount: (what: string) => boolean,
): Promise<void> {
  let payload: unknown;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    status("Could not read that file -- it may not be a valid PodMates backup.", true);
    return;
  }
  const envelope = payload as { decks?: unknown } | null;
  const decksToRestore = looksLikeDeckMap(envelope?.decks)
    ? envelope.decks
    : looksLikeDeckMap(payload)
      ? payload
      : null;
  if (!decksToRestore) {
    status("That file doesn't look like a PodMates backup.", true);
    return;
  }
  if (!requireAccount("decks")) {
    status("Sign up or log in first to restore a backup.", true);
    return;
  }
  try {
    const result = await mergeSavedDecks(decksToRestore);
    const extras: string[] = [];
    if (result.overLimit)
      extras.push(
        `${result.overLimit} not restored because you've reached the ${PM_LIMITS.maxSavedDecks}-deck limit`,
      );
    if (result.failed) extras.push(`${result.failed} couldn't be saved (too large or invalid)`);
    status(
      `Restored: ${result.added} new, ${result.updated} updated, ${result.skipped} already up to date.` +
        (extras.length ? " " + extras.join("; ") + "." : ""),
      extras.length > 0,
    );
    // Refresh the deck lists so the restore shows at once, not just saved in the background.
    await refreshSavedDecks();
  } catch (e) {
    // A permission or network error partway through would otherwise fail silently, with no way
    // to tell how much of it went through.
    status(
      "Restore did not fully complete: " +
        (e as Error).message +
        " -- some decks may have been saved before the error.",
      true,
    );
  }
}
