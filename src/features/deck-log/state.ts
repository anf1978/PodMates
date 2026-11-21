// Deck Log: what the panel shows, as plain values (no DOM, no Firebase).
import type { BattleCount, DeckChange, DeckLog } from "../../services/cloud/deck-log";

export type PanelState =
  | { kind: "signed-out" }
  | { kind: "unsaved" }
  | { kind: "loading"; name: string }
  | { kind: "missing"; name: string }
  | {
      kind: "log";
      name: string;
      log: DeckLog;
      /** The signed-in user owns this deck (wins and notes are theirs to change). */
      mine: boolean;
      /** The change entry whose note is being edited, if any. */
      editing: string | null;
      busy: boolean;
      error: string | null;
    };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "14 Nov 2026" (local time). */
export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function ago(ms: number, now: number): string {
  const m = Math.max(0, Math.round((now - ms) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export const battlesTotal = (b: BattleCount): number => b.exact + b.approximate;

/** "43%" once the deck has 3 or more battles; null before that. */
export function winRate(wins: number, battles: number): string | null {
  if (battles < 3) return null;
  return `${Math.round((Math.min(wins, battles) / battles) * 100)}%`;
}

/** "First Charted" text: the first save. Decks saved before Deck Logs have no record of it
 * (their savedAt is the latest save, not the first). */
export function firstCharted(deck: { firstSavedAt?: number }): string {
  return deck.firstSavedAt ? formatDate(deck.firstSavedAt) : "Before Deck Logs";
}

/** "2 Island" -> { qty: 2, name: "Island" }. */
export function cardLine(line: string): { qty: number; name: string } {
  const m = /^(\d+)\s+(.+)$/.exec(line.trim());
  return m ? { qty: Number(m[1]), name: m[2]! } : { qty: 1, name: line.trim() };
}

const spark = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "–";

/** "+3 −2 · Spark 5.2 → 5.6" for a change entry's header. */
export function changeSummary(
  change: Pick<DeckChange, "added" | "removed" | "sparkBefore" | "sparkAfter">,
): string {
  const count = (lines: string[]) => lines.reduce((n, line) => n + cardLine(line).qty, 0);
  return `+${count(change.added || [])} −${count(change.removed || [])} · Spark ${spark(change.sparkBefore)} → ${spark(change.sparkAfter)}`;
}

/** "3 about right · 1 stronger", or null before any answers. */
export function sparkChecksLine(tally: {
  stronger: number;
  right: number;
  weaker: number;
}): string | null {
  const parts = [
    tally.right ? `${tally.right} about right` : "",
    tally.stronger ? `${tally.stronger} stronger` : "",
    tally.weaker ? `${tally.weaker} weaker` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
