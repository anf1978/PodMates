// Deck Log: per-deck history on users/{uid}/decks/{deckId}. The counters live on the deck document
// (firstSavedAt, chartCount, podViewCount, lastChartedAt, lastChartedBy, wins); the change log is the
// users/{uid}/decks/{deckId}/changes sub-collection; battles are counted from the pods' Chronicles.
// Everything here is best effort: a failed log write never gets in the way of saving or charting.
import { parseDecklist } from "../../cards/parse-decklist";
import { loadAllChronicles } from "./chronicles";
import { loadSparkChecks } from "./deck-notes";
import {
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "./firebase";
import { PM_LIMITS } from "./limits";
import { loadMyPods } from "./pods";
import { getCurrentUser, requireUser } from "./session";
import { actorName, clampText } from "./shared";
import type { ChronicleDoc, DeckChangeDoc, DeckDoc, WithId } from "./types";
import { reportError } from "../report-error";

/** Which saved deck: its owner and its Firestore document id. */
export interface DeckRef {
  uid: string;
  id: string;
}

export type DeckChange = WithId<DeckChangeDoc>;

export interface BattleCount {
  /** Battles that recorded this exact saved deck. */
  exact: number;
  /** Older battles (before decks were recorded) by the same player with the same commander. */
  approximate: number;
}

export interface DeckLog {
  ref: DeckRef;
  deck: DeckDoc;
  changes: DeckChange[];
  battles: BattleCount;
  /** The owner's after-battle answers: how the deck played against its Spark. */
  sparkChecks: SparkTally;
}

export interface SparkTally {
  stronger: number;
  right: number;
  weaker: number;
}

const deckDoc = (ref: DeckRef) => doc(db, "users", ref.uid, "decks", ref.id);
const changesCol = (ref: DeckRef) => collection(db, "users", ref.uid, "decks", ref.id, "changes");

/** Command Spark for a list, supplied by the page once the card database is ready (null before). */
let sparkOf: (list: string, commander: string) => number | null = () => null;
export function configureDeckLog(options: {
  sparkOf(list: string, commander: string): number | null;
}): void {
  sparkOf = options.sparkOf;
}

function counts(list: string): Map<string, { name: string; qty: number }> {
  const out = new Map<string, { name: string; qty: number }>();
  for (const { name, qty } of parseDecklist(list).entries) {
    const key = name.trim().toLowerCase();
    const prev = out.get(key);
    out.set(key, { name: prev?.name || name.trim(), qty: (prev?.qty || 0) + qty });
  }
  return out;
}

/** Card lines added and removed between two decklists, as "N Card Name" (order: as listed). */
export function diffCards(before: string, after: string): { added: string[]; removed: string[] } {
  const a = counts(before);
  const b = counts(after);
  const added: string[] = [];
  const removed: string[] = [];
  for (const [key, card] of b) {
    const more = card.qty - (a.get(key)?.qty || 0);
    if (more > 0) added.push(`${more} ${card.name}`);
  }
  for (const [key, card] of a) {
    const fewer = card.qty - (b.get(key)?.qty || 0);
    if (fewer > 0) removed.push(`${fewer} ${card.name}`);
  }
  const cap = PM_LIMITS.deckChangeCards;
  return { added: added.slice(0, cap), removed: removed.slice(0, cap) };
}

/** Adds a change entry for the signed-in owner's deck, then keeps only the newest entries. */
export async function recordDeckChange(
  ref: DeckRef,
  before: { list: string; commander: string },
  after: { list: string; commander: string },
): Promise<void> {
  try {
    const { added, removed } = diffCards(before.list, after.list);
    if (!added.length && !removed.length) return;
    const entry: DeckChangeDoc = {
      at: Date.now(),
      added,
      removed,
      sparkBefore: sparkOf(before.list, before.commander),
      sparkAfter: sparkOf(after.list, after.commander),
    };
    await setDoc(doc(changesCol(ref)), entry);
    const all = await getDocs(query(changesCol(ref), orderBy("at", "desc")));
    const stale: string[] = [];
    let n = 0;
    all.forEach((snap) => {
      if (++n > PM_LIMITS.deckChangeLog) stale.push(snap.id);
    });
    for (const id of stale) await deleteDoc(doc(changesCol(ref), id));
  } catch (err) {
    reportError(err, { operation: "cloud" });
  }
}

/** Counts one chart of a saved deck: the owner's own count, or a podmate's view. */
export async function recordDeckChart(ref: DeckRef): Promise<void> {
  try {
    const user = getCurrentUser();
    if (!user || user.isAnonymous) return;
    const snap = await getDoc(deckDoc(ref));
    if (!snap.exists()) return;
    const deck = snap.data() as DeckDoc;
    const mine = user.uid === ref.uid;
    if (!mine && deck.secret === true) return;
    const field = mine ? "chartCount" : "podViewCount";
    await updateDoc(deckDoc(ref), {
      [field]: (Number(deck[field]) || 0) + 1,
      lastChartedAt: Date.now(),
      lastChartedBy: actorName(user, "Someone", 80),
    });
  } catch (err) {
    reportError(err, { operation: "cloud" });
  }
}

/** Owner only: adds `delta` (+1 or -1) to the deck's wins, never below zero. Returns the new count. */
export async function changeDeckWins(ref: DeckRef, delta: 1 | -1): Promise<number> {
  const user = requireUser();
  if (user.uid !== ref.uid) throw new Error("Only the deck's owner can change its wins.");
  const snap = await getDoc(deckDoc(ref));
  if (!snap.exists()) throw new Error("That deck no longer exists.");
  const wins = Math.max(0, (Number((snap.data() as DeckDoc).wins) || 0) + delta);
  await updateDoc(deckDoc(ref), { wins });
  return wins;
}

/** Owner only: the note on one change entry (empty removes it). */
export async function setDeckChangeNote(
  ref: DeckRef,
  changeId: string,
  note: string,
): Promise<void> {
  const user = requireUser();
  if (user.uid !== ref.uid) throw new Error("Only the deck's owner can edit its notes.");
  await updateDoc(doc(changesCol(ref), changeId), {
    note: clampText(String(note || "").trim(), PM_LIMITS.deckChangeNote),
  });
}

const commanderKey = (label: unknown) =>
  String(label || "")
    .split("/")
    .map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .sort()
    .join("|");

/** Battles of one saved deck across Chronicles entries (each entry counts once). */
export function countBattles(
  ref: DeckRef,
  deck: Pick<DeckDoc, "commander">,
  entries: readonly Pick<ChronicleDoc, "decks">[],
): BattleCount {
  const commander = commanderKey(deck.commander);
  let exact = 0;
  let approximate = 0;
  for (const entry of entries) {
    const decks = (Array.isArray(entry.decks) ? entry.decks : []) as Array<{
      uid?: unknown;
      commander?: unknown;
      deckRef?: { uid?: unknown; id?: unknown } | null;
    }>;
    if (decks.some((d) => d?.deckRef?.uid === ref.uid && d.deckRef.id === ref.id)) exact++;
    else if (
      commander &&
      decks.some(
        (d) => d && !d.deckRef && d.uid === ref.uid && commanderKey(d.commander) === commander,
      )
    )
      approximate++;
  }
  return { exact, approximate };
}

/** Battles from every pod the viewer shares with the deck's owner. */
async function loadBattles(ref: DeckRef, deck: DeckDoc): Promise<BattleCount> {
  try {
    const pods = (await loadMyPods()).filter((pod) => (pod.memberIds || []).includes(ref.uid));
    const entries = (await Promise.all(pods.map((pod) => loadAllChronicles(pod.id)))).flat();
    return countBattles(ref, deck, entries);
  } catch (err) {
    reportError(err, { operation: "cloud" });
    return { exact: 0, approximate: 0 };
  }
}

/** Everything the Deck Log panel shows, or null when the deck can't be read (gone or not shared). */
export async function loadDeckLog(ref: DeckRef): Promise<DeckLog | null> {
  requireUser();
  let deck: DeckDoc;
  try {
    const snap = await getDoc(deckDoc(ref));
    if (!snap.exists()) return null;
    deck = snap.data() as DeckDoc;
  } catch (err) {
    reportError(err, { operation: "cloud" });
    return null;
  }
  const changes: DeckChange[] = [];
  try {
    const snap = await getDocs(
      query(changesCol(ref), orderBy("at", "desc"), limit(PM_LIMITS.deckChangeLog)),
    );
    snap.forEach((d) => changes.push({ id: d.id, ...(d.data() as DeckChangeDoc) }));
  } catch (err) {
    reportError(err, { operation: "cloud" });
  }
  return {
    ref,
    deck,
    changes,
    battles: await loadBattles(ref, deck),
    sparkChecks: await tallySparkChecks(ref),
  };
}

async function tallySparkChecks(ref: DeckRef): Promise<SparkTally> {
  const tally: SparkTally = { stronger: 0, right: 0, weaker: 0 };
  try {
    for (const check of await loadSparkChecks(ref)) tally[check.verdict]++;
  } catch (err) {
    reportError(err, { operation: "cloud" });
  }
  return tally;
}
