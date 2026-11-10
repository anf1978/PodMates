// pods/{podId}/chronicles: the pod's append-only match-history journal (auto-generated ids).
import { arrayUnion, collection, db, deleteDoc, doc, getDocs, setDoc, updateDoc } from "./firebase";
import { PM_LIMITS } from "./limits";
import { loadPodDoc } from "./pods";
import { requireUser } from "./session";
import { actorName, clampText, countDocs, requireText } from "./shared";
import type { ChronicleDoc, ChronicleInput, FeedbackResponse, WithId } from "./types";

export const chroniclesCol = (podId: string) => collection(db, "pods", podId, "chronicles");
const chronicleRef = (podId: string, chronicleId: string) =>
  doc(db, "pods", podId, "chronicles", chronicleId);

const isNotFound = (e: unknown) => !!e && (e as { code?: string }).code === "not-found";

export async function addChronicleEntry(podId: string, entry: ChronicleInput): Promise<string> {
  const user = requireUser();
  if (!podId) throw new Error("No pod selected");
  const L = PM_LIMITS;
  if (L.maxChroniclesPerPod) {
    const haveEntries = await countDocs(chroniclesCol(podId));
    if (haveEntries >= L.maxChroniclesPerPod)
      throw new Error(
        `This pod's Chronicles are full (${L.maxChroniclesPerPod} entries). Clear some old entries to keep logging.`,
      );
  }
  const ref = doc(chroniclesCol(podId));
  const data: ChronicleDoc = {
    date: clampText(entry.date || "", 60),
    notes: clampText(entry.notes || "", L.notes),
    decks: (entry.decks || []).slice(0, L.chronicleDecks || 6),
    createdAt: entry.createdAt || Date.now(),
    loggedBy: actorName(user, "Someone", L.displayName),
    // Only set when this entry came from Log Battle inside a Gathering; the title is denormalized
    // so the Chronicles view can group entries without a lookup per entry.
    gatheringId: entry.gatheringId || null,
    gatheringTitle: entry.gatheringTitle ? clampText(entry.gatheringTitle, L.gatheringTitle) : null,
    participants: (entry.participants || []).slice(0, L.chronicleParticipants || 12),
    feedbackResponses: [],
  };
  await setDoc(ref, data);
  return ref.id;
}

// Appended via arrayUnion (atomic) so near-simultaneous submissions can't overwrite one another.
// updateDoc, not a merge set, so a deleted entry isn't silently re-created holding one rating.
export async function addChronicleFeedback(
  podId: string,
  chronicleId: string,
  feedback: { fun?: unknown; accuracy?: unknown; bestMoment?: string },
): Promise<void> {
  const user = requireUser();
  const response: FeedbackResponse = {
    uid: user.uid,
    displayName: actorName(user, "Someone", PM_LIMITS.displayName),
    fun: feedback.fun,
    accuracy: feedback.accuracy,
    bestMoment: clampText(feedback.bestMoment || "", PM_LIMITS.bestMoment),
    submittedAt: Date.now(),
  };
  try {
    await updateDoc(chronicleRef(podId, chronicleId), { feedbackResponses: arrayUnion(response) });
  } catch (e) {
    if (isNotFound(e))
      throw new Error("This battle's Chronicle entry was deleted, so it can't be rated.");
    throw e;
  }
}

// Only the notes change. Who may do this (the battle's players and the pod's leaders) is decided
// by firestore.rules.
export async function updateChronicleNotes(
  podId: string,
  chronicleId: string,
  notes: unknown,
): Promise<void> {
  const user = requireUser();
  const text = requireText(String(notes == null ? "" : notes).trim(), PM_LIMITS.notes, "Notes");
  try {
    await updateDoc(chronicleRef(podId, chronicleId), {
      notes: text,
      notesEditedAt: Date.now(),
      notesEditedBy: actorName(user, "Someone", PM_LIMITS.displayName),
    });
  } catch (e) {
    if (isNotFound(e)) throw new Error("That Chronicle entry no longer exists.");
    throw e;
  }
}

export async function deleteChronicleEntry(podId: string, chronicleId: string): Promise<void> {
  requireUser();
  await deleteDoc(chronicleRef(podId, chronicleId));
}

export async function loadAllChronicles(podId: string): Promise<Array<WithId<ChronicleDoc>>> {
  requireUser();
  if (!podId) return [];
  const snap = await getDocs(chroniclesCol(podId));
  const out: Array<WithId<ChronicleDoc>> = [];
  snap.forEach((docSnap) => out.push({ id: docSnap.id, ...(docSnap.data() as ChronicleDoc) }));
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out;
}

// Wiping every entry is a leaders-only action (a player can only delete their own battles).
export async function clearAllChronicles(podId: string): Promise<void> {
  const user = requireUser();
  if (!podId) return;
  const podInfo = await loadPodDoc(podId);
  if (podInfo.leaderId !== user.uid && !(podInfo.coLeaderIds || []).includes(user.uid)) {
    throw new Error("Only the pod's leaders can clear all Chronicles.");
  }
  const snap = await getDocs(chroniclesCol(podId));
  const deletions: Array<Promise<void>> = [];
  snap.forEach((docSnap) => deletions.push(deleteDoc(docSnap.ref)));
  await Promise.all(deletions);
}
