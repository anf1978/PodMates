// Saved decks live entirely on Firebase, tied to a real account: no local storage, no anonymous
// fallback. These caches are in-memory mirrors ONLY (never persisted), so the many callers that read
// the decks synchronously keep working while the data always comes from and goes to Firestore. A
// reload always re-fetches; there is deliberately nothing to fall back to locally.
//
// Podmates' shared decks are keyed distinctly from your own (`pm:{uid}:{key}`), so a podmate's deck
// can never collide with or overwrite one of yours in the merged lists.
import { action, load } from "./cloud/operations";
import { loadAllDecks, loadPodmateDecksRaw, saveDeck } from "./cloud/decks";
import { PM_LIMITS } from "./cloud/limits";
import { loadPodMembers } from "./cloud/members";
import { loadMyPods } from "./cloud/pods";
import { getCurrentUser, isCloudReady } from "./cloud/session";
import type { DeckInput, PodmateDeck, SavedDeck } from "./cloud/types";

/** Load a Deck opened for a Gathering seat (rather than the Deck Chart form). */
export interface DeckPickTarget {
  gatheringSeat: {
    podId: string;
    gatheringId: string;
    seatIndex: number;
    seatUid: string | null;
    seatIsGuest: boolean;
    seatDisplayName: string;
  };
}

/** A podmate's shared deck, tagged with whose it is. */
export type PodmateCacheEntry = PodmateDeck & { mine: false; ownerUid: string; ownerName: string };

// The same error reporting the cloud bridge applies to these calls.
const cloud = {
  loadAllDecks: load(loadAllDecks),
  loadPodmateDecksRaw: load(loadPodmateDecksRaw),
  loadMyPods: load(loadMyPods),
  loadPodMembers: load(loadPodMembers),
  saveDeck: action(saveDeck),
};

let savedDecks: Record<string, SavedDeck> = {};
let podmateDecks: Record<string, PodmateCacheEntry> = {};
let savedInflight: Promise<boolean> | null = null;
let podmateInflight: Promise<{ ok: boolean; partial: boolean }> | null = null;

/** This account's saved decks, by key (the in-memory mirror). */
export function loadSavedDecks(): Record<string, SavedDeck> {
  return savedDecks;
}

/** Podmates' shared decks across every pod this person is in. */
export function podmateSavedDecks(): Record<string, PodmateCacheEntry> {
  return podmateDecks;
}

/** Drops one deck from the mirror at once, before the refresh that follows a delete. */
export function forgetSavedDeck(key: string): void {
  delete savedDecks[key];
}

// Wait (briefly) for the cloud to finish checking who is signed in. When the app is opened from a
// home-screen icon the page can be ready before sign-in has been confirmed; asking too early used to
// look exactly like "no decks".
export function waitCloudReady(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = (): void => {
      if (isCloudReady()) return resolve(true);
      if (Date.now() - t0 >= ms) return resolve(false);
      setTimeout(tick, 150);
    };
    tick();
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function retry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await sleep(350 * (i + 1) * (i + 1));
    }
  }
  throw lastErr;
}

/** Gives a network step a time limit, so a stalled connection ends in an error, not "Loading…". */
export function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// Resolves true only when the list is KNOWN to be right. A failed fetch keeps what was already
// loaded (it used to wipe the list, which is what showed "No saved decks" after a hiccup).
export function refreshSavedDecks(): Promise<boolean> {
  if (savedInflight) return savedInflight;
  savedInflight = (async () => {
    const ready = await waitCloudReady(8000);
    if (!ready) return false;
    if (!getCurrentUser()) {
      savedDecks = {}; // really signed out
      return true;
    }
    try {
      savedDecks = await retry(() => cloud.loadAllDecks(), 3);
      return true;
    } catch (e) {
      console.warn("Saved decks did not load", e);
      return false;
    }
  })().finally(() => {
    savedInflight = null;
  });
  return savedInflight;
}

function isPermissionDenied(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return !!err && (err.code === "permission-denied" || /permission/i.test(err.message || ""));
}

// Podmates' shared decks, across EVERY pod this person is in. A podmate whose fetch fails keeps the
// decks already loaded for them; `partial` says some did not load.
export function refreshPodmateDecks(): Promise<{ ok: boolean; partial: boolean }> {
  if (podmateInflight) return podmateInflight;
  podmateInflight = (async () => {
    await waitCloudReady(8000);
    const user = getCurrentUser();
    if (!user) {
      podmateDecks = {};
      return { ok: true, partial: false };
    }
    let partial = false;
    let pods;
    try {
      pods = await retry(() => cloud.loadMyPods(), 3);
    } catch {
      return { ok: false, partial: true }; // keep whatever is already loaded
    }
    if (!pods.length) {
      podmateDecks = {};
      return { ok: true, partial: false };
    }
    const memberLists = await Promise.all(
      pods.map((p) =>
        retry(() => cloud.loadPodMembers(p.id), 3).catch(() => {
          partial = true;
          return [];
        }),
      ),
    );
    const podmates = new Map<string, (typeof memberLists)[number][number]>();
    for (const members of memberLists)
      for (const m of members)
        if (m.uid !== user.uid && !podmates.has(m.uid)) podmates.set(m.uid, m);
    const okUids = new Set<string>();
    const results = await Promise.all(
      [...podmates.values()].map(async (m) => {
        try {
          const decks = await retry(() => cloud.loadPodmateDecksRaw(m.uid), 3);
          okUids.add(m.uid);
          return { member: m, decks };
        } catch (e) {
          // Expected when nothing is shared.
          if (isPermissionDenied(e)) okUids.add(m.uid);
          else partial = true;
          return { member: m, decks: {} as Record<string, PodmateDeck> };
        }
      }),
    );
    // Build the new map aside and swap it in whole, so a screen never sees a half-built list.
    const next: Record<string, PodmateCacheEntry> = {};
    for (const { member, decks } of results) {
      for (const [key, entry] of Object.entries(decks)) {
        next[`pm:${member.uid}:${key}`] = Object.assign({}, entry, {
          mine: false as const,
          ownerUid: member.uid,
          ownerName: member.displayLabel || member.displayName || "Podmate",
        });
      }
    }
    for (const [k, e] of Object.entries(podmateDecks))
      if (e.ownerUid && !okUids.has(e.ownerUid) && !(k in next)) next[k] = e;
    podmateDecks = next;
    return { ok: !partial, partial };
  })().finally(() => {
    podmateInflight = null;
  });
  return podmateInflight;
}

export interface MergeResult {
  added: number;
  updated: number;
  skipped: number;
  overLimit: number;
  failed: number;
  total: number;
}

// Last-write-wins merge, keyed by savedAt, for "Restore from Backup". Whole-record merge is safe
// because a saved deck is a self-contained unit. The caller checks the account first.
export async function mergeSavedDecks(
  importedDecks: Record<string, DeckInput | string>,
): Promise<MergeResult> {
  const existing = loadSavedDecks();
  let added = 0,
    updated = 0,
    skipped = 0,
    overLimit = 0;
  const writes: Promise<void>[] = [];
  // New decks only fit while the account is under its cap. Counted up front, because the writes
  // below all run at once and would each see the same "still room" answer.
  let room = Math.max(0, PM_LIMITS.maxSavedDecks - Object.keys(existing).length);
  for (const [key, incoming] of Object.entries(importedDecks)) {
    const incomingObj: DeckInput =
      typeof incoming === "string"
        ? { list: incoming, commander: "", player: "", savedAt: 0 }
        : incoming;
    const current = existing[key];
    if (!current) {
      if (room <= 0) {
        overLimit++;
        continue;
      }
      room--;
      writes.push(cloud.saveDeck(key, incomingObj));
      added++;
    } else {
      const currentTime = (typeof current === "object" ? current.savedAt : 0) || 0;
      if ((incomingObj.savedAt || 0) > currentTime) {
        writes.push(cloud.saveDeck(key, incomingObj));
        updated++;
      } else {
        skipped++;
      }
    }
  }
  // One oversized or malformed deck in a backup shouldn't sink the others.
  const settled = await Promise.allSettled(writes);
  const failed = settled.filter((r) => r.status === "rejected").length;
  added = Math.max(0, added - failed); // (a failed write isn't a deck that was added)
  await refreshSavedDecks();
  return { added, updated, skipped, overLimit, failed, total: Object.keys(importedDecks).length };
}
