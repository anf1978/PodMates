// When re-saving a deck should tell the pod: only when its card list really changed, and for
// automatic syncs at most once per deck per day (remembered on this device only).
import { reportError } from "../report-error";

/** How an overwrite whose card list changed tells the pod: "now" (a hand save), "daily" (automatic
 * linked-deck syncs: at most one notice per deck per 24 h on this device) or false (backup
 * restores and mirror repairs, which are not edits). */
export type UpdateNotice = "now" | "daily" | false;

export const DAILY_MS = 24 * 60 * 60 * 1000;
const storageKey = (uid: string) => `pm_deck_update_notice_${uid}`;

/** A decklist's cards, ignoring order, blank lines, spacing and letter case. */
export function cardListKey(list: string): string {
  return list
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " ").toLowerCase())
    .filter(Boolean)
    .sort()
    .join("\n");
}

/** True when the new list differs from the stored one. An unknown stored list (a failed read)
 * never counts as a change, so a flaky network cannot announce an edit that did not happen. */
export function cardListChanged(before: string | null, after: string): boolean {
  return before !== null && cardListKey(before) !== cardListKey(after);
}

function readTimes(uid: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch (err) {
    reportError(err, { operation: "notifications" });
    return {};
  }
}

/** For "daily" notices: true (and remembered) if this deck has not announced an update on this
 * device in the last 24 hours. Storage failures allow the notice rather than block it. */
export function claimDailyNotice(uid: string, deckId: string, now: number): boolean {
  const times = readTimes(uid);
  const last = times[deckId];
  if (typeof last === "number" && now - last < DAILY_MS) return false;
  const kept: Record<string, number> = {};
  for (const [id, at] of Object.entries(times)) {
    if (typeof at === "number" && now - at < DAILY_MS) kept[id] = at;
  }
  kept[deckId] = now;
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(kept));
  } catch (err) {
    reportError(err, { operation: "notifications" });
  }
  return true;
}

/** Whether this save should post a "deck updated" notice. */
export function shouldAnnounceUpdate(
  mode: UpdateNotice,
  args: { uid: string; deckId: string; before: string | null; after: string; now: number },
): boolean {
  if (mode === false || !cardListChanged(args.before, args.after)) return false;
  return mode === "now" || claimDailyNotice(args.uid, args.deckId, args.now);
}
