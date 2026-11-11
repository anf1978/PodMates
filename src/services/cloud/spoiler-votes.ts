// users/{uid}/spoilerVotes/{card}: Spoiler Bait votes. Podmates can read them (firestore.rules);
// only the owner writes.
import { collection, db, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "./firebase";
import { loadPodMembers } from "./members";
import { requireUser } from "./session";
import { safeDocId } from "./shared";
import type { SpoilerVoteDoc } from "./types";
import { reportError } from "../report-error";

export const spoilerVotesCol = (uid: string) => collection(db, "users", uid, "spoilerVotes");
const spoilerVoteRef = (uid: string, key: string) =>
  doc(db, "users", uid, "spoilerVotes", safeDocId(key));

export async function setSpoilerVote(
  card: { key?: unknown; n?: unknown; setName?: unknown },
  vote: unknown,
): Promise<void> {
  const user = requireUser();
  if (vote !== "like" && vote !== "pass") throw new Error("Bad vote.");
  const key = String(card.key || "").slice(0, 120);
  if (!key) throw new Error("No card.");
  await setDoc(spoilerVoteRef(user.uid, key), {
    key,
    n: String(card.n || "").slice(0, 200),
    setName: String(card.setName || "").slice(0, 100),
    vote,
    votedAt: Date.now(),
    updatedAt: serverTimestamp(),
  });
}

export async function clearSpoilerVote(key: unknown): Promise<void> {
  const user = requireUser();
  await deleteDoc(spoilerVoteRef(user.uid, String(key).slice(0, 120)));
}

export async function loadSpoilerVotes(uid: string): Promise<SpoilerVoteDoc[]> {
  const user = requireUser();
  try {
    const snap = await getDocs(spoilerVotesCol(uid));
    return snap.docs
      .map((d) => d.data() as SpoilerVoteDoc)
      .filter((v) => v && v.key && (v.vote === "like" || v.vote === "pass"));
  } catch (e) {
    if (uid === user.uid) throw e;
    reportError(e, { operation: "cloud" });
    return []; // a podmate we cannot read just shows as empty
  }
}

export async function loadPodSpoilerVotes(podId: string) {
  const members = await loadPodMembers(podId);
  return Promise.all(
    members.map(async (m) => ({
      uid: m.uid,
      name: m.displayLabel || m.displayName || "Podmate",
      votes: await loadSpoilerVotes(m.uid),
    })),
  );
}
