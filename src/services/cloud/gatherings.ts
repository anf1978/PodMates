// pods/{podId}/gatherings: multiplayer table setup. Seats are a MAP keyed "0".."5", and every seat
// write targets a dot-notation field path ("seats.0") with updateDoc, so two players editing two
// different seats at once can never wipe out each other's seat. (A merge set does NOT interpret
// dotted keys as field paths -- it would create a stray top-level "seats.1" field.)
// Statuses: proposed (waiting for replies) -> live -> ended, or proposed -> cancelled.
import { reportError } from "../report-error";
import {
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type SnapshotMetadata,
  type Unsubscribe,
} from "./firebase";
import { logActivity } from "./activity";
import { addChronicleEntry } from "./chronicles";
import { PM_LIMITS } from "./limits";
import { requireUser } from "./session";
import { actorName, clampText, deckListProblem } from "./shared";
import type {
  ChronicleInput,
  GatheringDoc,
  GatheringSeat,
  GatheringStatus,
  SeatRsvp,
  SharedDeck,
  WithId,
} from "./types";

export type Gathering = WithId<GatheringDoc>;
type OnError = ((err: Error) => void) | undefined;

export interface CreateGatheringOptions {
  seats?: Record<
    string,
    { uid?: unknown; displayName?: string; rsvp?: SeatRsvp; guest?: boolean } | null
  >;
  status?: GatheringStatus;
  whenDate?: string;
  whenTime?: string;
  place?: unknown;
}

export const gatheringsCol = (podId: string) => collection(db, "pods", podId, "gatherings");
const gatheringRef = (podId: string, gatheringId: string) =>
  doc(db, "pods", podId, "gatherings", gatheringId);
const liveQuery = (podId: string) => query(gatheringsCol(podId), where("status", "==", "live"));
const openQuery = (podId: string) =>
  query(gatheringsCol(podId), where("status", "in", ["proposed", "live"]));

export function emptyGatheringSeats(): Record<string, GatheringSeat> {
  const seats: Record<string, GatheringSeat> = {};
  for (let i = 0; i < 6; i++) seats[i] = { uid: null, displayName: null, deck: null };
  return seats;
}

// Everything is written in ONE document write, so a failure can never leave a half-made gathering.
export async function createGathering(
  podId: string,
  title: string | null | undefined,
  opts?: CreateGatheringOptions,
): Promise<string> {
  const user = requireUser();
  if (!podId) throw new Error("No pod selected");
  opts = opts || {};
  const seats = emptyGatheringSeats();
  seats[0] = {
    uid: user.uid,
    displayName: actorName(user, "Host", PM_LIMITS.displayName),
    deck: null,
    rsvp: "accepted",
  };
  const given = opts.seats || {};
  for (const k of Object.keys(given)) {
    const i = Number(k),
      s = given[k];
    if (!(i >= 1 && i <= 5) || !s || !s.uid) continue;
    seats[i] = {
      uid: String(s.uid).slice(0, 80),
      displayName: clampText(s.displayName || "Podmate", PM_LIMITS.displayName),
      deck: null,
      rsvp: s.rsvp === "invited" ? "invited" : "accepted",
    };
    if (s.guest) seats[i].guest = true;
  }
  const status: GatheringStatus =
    opts.status === "proposed" ? "proposed" : opts.status === "live" ? "live" : "setup";
  const cleanTitle = clampText(
    (title || "").trim() || "Untitled Gathering",
    PM_LIMITS.gatheringTitle,
  );
  const data: GatheringDoc = {
    title: cleanTitle,
    hostUid: user.uid,
    status,
    seats,
    createdAt: Date.now(),
    updatedAt: serverTimestamp(),
  };
  if (status === "live") data.goLiveAt = Date.now();
  if (opts.whenDate) data.whenDate = clampText(opts.whenDate, 10);
  if (opts.whenTime) data.whenTime = clampText(opts.whenTime, 5);
  if (opts.place) data.place = clampText(String(opts.place).trim(), 120);
  const ref = doc(gatheringsCol(podId));
  await setDoc(ref, data);
  if (status === "live") logActivity("live", cleanTitle, { podIds: [podId], ref: ref.id });
  return ref.id;
}

export async function loadGathering(podId: string, gatheringId: string): Promise<Gathering | null> {
  requireUser();
  const snap = await getDoc(gatheringRef(podId, gatheringId));
  return snap.exists() ? { id: snap.id, ...(snap.data() as GatheringDoc) } : null;
}

// Live listeners: Firebase pushes each change within about a second. Each returns a function that
// stops listening; if one fails, onError runs and the page falls back to polling.
export function watchGathering(
  podId: string,
  gatheringId: string,
  onData: (g: Gathering | null, metadata: SnapshotMetadata) => void,
  onError?: OnError,
): Unsubscribe {
  requireUser();
  return onSnapshot(
    gatheringRef(podId, gatheringId),
    (snap) =>
      onData(
        snap.exists() ? { id: snap.id, ...(snap.data() as GatheringDoc) } : null,
        snap.metadata,
      ),
    (err) => {
      reportError(err, { operation: "cloud" });
      if (onError) onError(err);
    },
  );
}

function watchList(
  q: ReturnType<typeof liveQuery>,
  onData: (list: Gathering[]) => void,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    q,
    (snap) => {
      const out: Gathering[] = [];
      snap.forEach((d) => out.push({ id: d.id, ...(d.data() as GatheringDoc) }));
      onData(out);
    },
    (err) => {
      reportError(err, { operation: "cloud" });
      if (onError) onError(err);
    },
  );
}

async function loadList(q: ReturnType<typeof liveQuery>): Promise<Gathering[]> {
  const snap = await getDocs(q);
  const out: Gathering[] = [];
  snap.forEach((d) => out.push({ id: d.id, ...(d.data() as GatheringDoc) }));
  return out;
}

export function watchLiveGatherings(
  podId: string,
  onData: (list: Gathering[]) => void,
  onError?: OnError,
): Unsubscribe {
  requireUser();
  if (!podId) return () => {};
  return watchList(liveQuery(podId), onData, onError);
}

export async function loadLiveGatherings(podId: string): Promise<Gathering[]> {
  requireUser();
  if (!podId) return [];
  return loadList(liveQuery(podId));
}

// Waiting and live gatherings together (what the landing page shows).
export async function loadOpenGatherings(podId: string): Promise<Gathering[]> {
  requireUser();
  if (!podId) return [];
  return loadList(openQuery(podId));
}

export function watchOpenGatherings(
  podId: string,
  onData: (list: Gathering[]) => void,
  onError?: OnError,
): Unsubscribe {
  requireUser();
  if (!podId) return () => {};
  return watchList(openQuery(podId), onData, onError);
}

export async function setGatheringSeat(
  podId: string,
  gatheringId: string,
  seatIndex: number | string,
  seatData: GatheringSeat | null,
): Promise<void> {
  requireUser();
  if (seatData && seatData.deck) {
    const seatListProblem = deckListProblem(seatData.deck.list || "");
    if (seatListProblem) throw new Error(seatListProblem);
  }
  if (seatData && seatData.displayName)
    seatData = { ...seatData, displayName: clampText(seatData.displayName, PM_LIMITS.displayName) };
  await updateDoc(gatheringRef(podId, gatheringId), {
    [`seats.${seatIndex}`]: seatData,
    updatedAt: serverTimestamp(),
  });
}

// A fresh battle starts un-logged, so the last battle's id can't pose as this one.
export async function markGatheringCharted(podId: string, gatheringId: string): Promise<void> {
  requireUser();
  await setDoc(
    gatheringRef(podId, gatheringId),
    {
      chartedAt: Date.now(),
      lastLoggedChronicleId: null,
      lastLoggedAt: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// Creates the Chronicle entry for this battle, then marks the Gathering with it -- which doubles as
// "the battle has been logged" and "here's where to submit your own feedback" for other seats.
export async function logBattle(
  podId: string,
  gatheringId: string,
  entry: ChronicleInput,
): Promise<string> {
  requireUser();
  const chronicleId = await addChronicleEntry(podId, entry);
  await setDoc(
    gatheringRef(podId, gatheringId),
    { lastLoggedChronicleId: chronicleId, lastLoggedAt: Date.now(), updatedAt: serverTimestamp() },
    { merge: true },
  );
  return chronicleId;
}

// Start New Battle: clears just the deck on every occupied seat ("seats.0.deck"), leaving who is
// sitting there untouched.
export async function resetGatheringDecks(podId: string, gatheringId: string): Promise<void> {
  requireUser();
  const snap = await getDoc(gatheringRef(podId, gatheringId));
  if (!snap.exists()) return;
  const seats = (snap.data() as GatheringDoc).seats || {};
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const k of Object.keys(seats)) {
    if (seats[k] && seats[k].uid) updates[`seats.${k}.deck`] = null;
  }
  await updateDoc(gatheringRef(podId, gatheringId), updates);
}

export async function goLiveGathering(podId: string, gatheringId: string): Promise<void> {
  requireUser();
  await setDoc(
    gatheringRef(podId, gatheringId),
    { status: "live", goLiveAt: Date.now(), updatedAt: serverTimestamp() },
    { merge: true },
  );
  getDoc(gatheringRef(podId, gatheringId))
    .then((g) =>
      logActivity("live", ((g.data() || {}) as Partial<GatheringDoc>).title || "Gathering", {
        podIds: [podId],
        ref: gatheringId,
      }),
    )
    .catch((err: unknown) => reportError(err, { operation: "cloud" }));
}

export async function endGathering(podId: string, gatheringId: string): Promise<void> {
  requireUser();
  await setDoc(
    gatheringRef(podId, gatheringId),
    { status: "ended", endedAt: Date.now(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function setSeatRsvp(
  podId: string,
  gatheringId: string,
  seatIndex: number | string,
  rsvp: unknown,
): Promise<void> {
  requireUser();
  if (rsvp !== "accepted" && rsvp !== "declined" && rsvp !== "invited")
    throw new Error("Unknown reply");
  await updateDoc(gatheringRef(podId, gatheringId), {
    [`seats.${seatIndex}.rsvp`]: rsvp,
    updatedAt: serverTimestamp(),
  });
}

// Changes only the deck on a seat, so who is sitting there (reply, guest flag...) is never touched.
export async function setSeatDeck(
  podId: string,
  gatheringId: string,
  seatIndex: number | string,
  deck: SharedDeck | null | undefined,
): Promise<void> {
  requireUser();
  if (deck && deck.list) {
    const p = deckListProblem(deck.list || "");
    if (p) throw new Error(p);
  }
  await updateDoc(gatheringRef(podId, gatheringId), {
    [`seats.${seatIndex}.deck`]: deck || null,
    updatedAt: serverTimestamp(),
  });
}

export async function updateGatheringDetails(
  podId: string,
  gatheringId: string,
  d: { title?: string | null; whenDate?: string | null; whenTime?: string | null; place?: unknown },
): Promise<void> {
  requireUser();
  const up: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (d.title != null)
    up.title = clampText((d.title || "").trim() || "Untitled Gathering", PM_LIMITS.gatheringTitle);
  if (d.whenDate != null) up.whenDate = clampText(d.whenDate, 10);
  if (d.whenTime != null) up.whenTime = clampText(d.whenTime, 5);
  if (d.place != null) up.place = clampText(String(d.place).trim(), 120);
  await updateDoc(gatheringRef(podId, gatheringId), up);
}

export async function cancelGathering(podId: string, gatheringId: string): Promise<void> {
  requireUser();
  await setDoc(
    gatheringRef(podId, gatheringId),
    { status: "cancelled", cancelledAt: Date.now(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}
