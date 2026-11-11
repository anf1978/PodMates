// Build Table (MyPods tab): your saved decks and podmates' shared ones, scored side by side.
import { analyzeDeckRows } from "../../services/deck-rows";
import { dropLinkedDuplicates } from "../../services/linked-duplicates";
import { referenceSummary } from "../../services/reference-data";
import { loadSavedDecks, podmateSavedDecks, refreshPodmateDecks } from "../../services/saved-decks";
import type { SavedDeck } from "../../services/cloud/types";
import { clearDecksTable, showDecksTable } from "../../ui/decks-table";
import { setStatusText } from "../../ui/status";
import { field } from "./form";
import { ports } from "./ports";

type TableDeck = Partial<SavedDeck> & { player?: string };

export async function buildSavedDecksTable(): Promise<void> {
  const statusEl = field("savedDecksTableStatus");
  const status = (message: string, isError?: boolean) => setStatusText(statusEl, message, isError);
  if (!ports().ready()) {
    status("Card database still loading — try again in a moment.", true);
    return;
  }
  status("Gathering decks…");
  await refreshPodmateDecks();
  const decks: Record<string, TableDeck> = Object.assign({}, loadSavedDecks());
  for (const [key, entry] of Object.entries(podmateSavedDecks())) {
    decks[key] = Object.assign({}, entry, { player: entry.ownerName });
  }
  // A linked deck that was also charted and saved is one deck: keep the saved one.
  const kept = new Set(dropLinkedDuplicates(Object.values(decks)));
  for (const k of Object.keys(decks)) if (!kept.has(decks[k]!)) delete decks[k];
  const count = Object.keys(decks).length;
  const area = field("savedDecksTableArea")!;
  if (count === 0) {
    status("No saved decks yet — save one from the main tab first.", true);
    clearDecksTable(area);
    return;
  }
  status(`Analyzing ${count} saved deck(s)…`);
  const { rows, failed } = analyzeDeckRows(decks, ports().analyze);
  status(
    failed
      ? `Built table for ${rows.length} deck(s) — ${failed} couldn't be parsed and were skipped.`
      : `Built table for ${rows.length} deck(s).`,
  );
  showDecksTable(area, rows, referenceSummary());
}
