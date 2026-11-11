// My Profile triggers the unmoved shared comparison-table renderer through typed ports.
import type { SavedDeck } from "../../services/cloud/types";
import { reportError } from "../../services/report-error";

export interface ProfileTableRuntime {
  ready: () => boolean;
  refresh: () => Promise<void>;
  saved: () => Record<string, SavedDeck>;
  deduplicate: (decks: SavedDeck[]) => SavedDeck[];
  analyze: (decks: Record<string, SavedDeck>) => { rows: unknown[]; failed: number };
  display: (rows: unknown[], area: HTMLElement) => void;
}

export async function buildProfileTable(runtime: ProfileTableRuntime): Promise<void> {
  const status = document.getElementById("profileTableStatus");
  const area = document.getElementById("profileTableArea");
  if (!status || !area) return;
  if (!runtime.ready()) {
    status.textContent = "Card database still loading — try again in a moment.";
    status.className = "status err";
    return;
  }
  status.textContent = "Analysing your decks…";
  status.className = "status";
  try {
    await runtime.refresh();
  } catch (error) {
    reportError(error, { operation: "cloud" });
  }
  const saved = runtime.saved();
  const kept = new Set(runtime.deduplicate(Object.values(saved)));
  const mine = Object.fromEntries(Object.entries(saved).filter(([, deck]) => kept.has(deck)));
  if (!Object.keys(mine).length) {
    status.textContent = "No saved decks yet.";
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 30));
  if (!area.isConnected) return;
  const { rows, failed } = runtime.analyze(mine);
  status.textContent =
    `Built table for ${rows.length} deck(s)` +
    (failed ? ` — ${failed} couldn't be parsed and were skipped.` : ".");
  runtime.display(rows, area);
}
