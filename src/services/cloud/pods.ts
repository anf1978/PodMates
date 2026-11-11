// pods/{podId}. Membership is tracked only on the pod document (memberIds, queried with
// array-contains): a user can only write their own users/{uid} document, so a leader removing
// someone could never update that person's doc. The pod document is the single source of truth.
import { reportError } from "../report-error";
import {
  arrayRemove,
  arrayUnion,
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "./firebase";
import { logActivity } from "./activity";
import { PM_LIMITS } from "./limits";
import { findNameConflict, loadPodMembers, memberRef } from "./members";
import { requireUser } from "./session";
import { actorName, countDocs, requireText } from "./shared";
import type { MemberDoc, PodDoc, WithId } from "./types";
import { setMyPodIds } from "./users";

export const podsCol = () => collection(db, "pods");
export const podRef = (podId: string) => doc(db, "pods", podId);
const myPodsQuery = (uid: string) => query(podsCol(), where("memberIds", "array-contains", uid));

export type JoinPodResult =
  | { ok: true; podId: string; podName: string }
  | { ok: false; error: string; podId?: string; podName?: string; nameConflict?: true };

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I/L -- easy to misread otherwise
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function loadPodDoc(podId: string): Promise<Partial<PodDoc>> {
  const snap = await getDoc(podRef(podId));
  return snap.exists() ? (snap.data() as PodDoc) : {};
}

export async function createPod(
  name: string | null | undefined,
): Promise<{ ok: true; podId: string; inviteCode: string }> {
  const user = requireUser();
  const L = PM_LIMITS;
  const podName = (name || "").trim() || "Our Pod";
  requireText(podName, L.podName, "Pod name");
  if (L.maxPodsPerUser) {
    const inPods = await countDocs(myPodsQuery(user.uid));
    if (inPods >= L.maxPodsPerUser)
      throw new Error(
        `You're already in ${L.maxPodsPerUser} pods, which is the limit. Leave one before creating another.`,
      );
  }
  const newPodRef = doc(podsCol());
  const inviteCode = generateInviteCode();
  await setDoc(newPodRef, {
    name: podName,
    leaderId: user.uid,
    coLeaderIds: [],
    memberIds: [user.uid],
    inviteCode,
    createdAt: serverTimestamp(),
  });
  const member: MemberDoc = {
    displayName: actorName(user, "Player", L.displayName),
    role: "leader",
    joinedAt: Date.now(),
  };
  await setDoc(memberRef(newPodRef.id, user.uid), member);
  return { ok: true, podId: newPodRef.id, inviteCode };
}

export async function joinPodByInviteCode(
  rawCode: string | null | undefined,
): Promise<JoinPodResult> {
  const user = requireUser();
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter an invite code or paste an invite link." };
  const snap = await getDocs(query(podsCol(), where("inviteCode", "==", code)));
  if (snap.empty)
    return { ok: false, error: "No pod found with that invite code -- double check the link." };
  const podDoc = snap.docs[0];
  const podId = podDoc.id;
  const podData = podDoc.data() as PodDoc;
  if ((podData.memberIds || []).includes(user.uid)) {
    return {
      ok: false,
      error: `You're already a member of "${podData.name}."`,
      podId,
      podName: podData.name,
    };
  }
  const L = PM_LIMITS;
  if (L.maxPodMembers && (podData.memberIds || []).length >= L.maxPodMembers) {
    return { ok: false, error: `That pod is full (${L.maxPodMembers} members).` };
  }
  if (L.maxPodsPerUser) {
    const inPods = await countDocs(myPodsQuery(user.uid));
    if (inPods >= L.maxPodsPerUser)
      return {
        ok: false,
        error: `You're already in ${L.maxPodsPerUser} pods, which is the limit. Leave one before joining another.`,
      };
  }
  const myJoinName = actorName(user, "Player", L.displayName);
  const sameName = await findNameConflict(podId, myJoinName, user.uid);
  if (sameName) {
    return {
      ok: false,
      nameConflict: true,
      podId,
      podName: podData.name,
      error: `"${podData.name}" already has a member called "${sameName.displayName}". Change your display name in your Profile, then use the invite again, so nobody gets mixed up.`,
    };
  }
  await setDoc(podRef(podId), { memberIds: arrayUnion(user.uid) }, { merge: true });
  const member: MemberDoc = { displayName: myJoinName, role: "member", joinedAt: Date.now() };
  await setDoc(memberRef(podId, user.uid), member);
  logActivity("joined", podData.name || "the pod", { podIds: [podId] });
  return { ok: true, podId, podName: podData.name };
}

export async function loadMyPods(): Promise<Array<WithId<PodDoc>>> {
  const user = requireUser();
  const snap = await getDocs(myPodsQuery(user.uid));
  const pods: Array<WithId<PodDoc>> = [];
  snap.forEach((d) => pods.push({ id: d.id, ...(d.data() as PodDoc) }));
  // Fire-and-forget: a failure here shouldn't break loading the pod list itself.
  setMyPodIds(
    user.uid,
    pods.map((p) => p.id),
  ).catch((err: unknown) => reportError(err, { operation: "cloud" }));
  return pods;
}

// Same podIds write loadMyPods does quietly, but this version does NOT swallow a failure.
export async function forceSyncMyPodIds(): Promise<string[]> {
  const user = requireUser();
  const snap = await getDocs(myPodsQuery(user.uid));
  const podIds: string[] = [];
  snap.forEach((d) => podIds.push(d.id));
  await setMyPodIds(user.uid, podIds);
  return podIds;
}

export async function leavePod(podId: string): Promise<void> {
  const user = requireUser();
  await deleteDoc(memberRef(podId, user.uid));
  await setDoc(podRef(podId), { memberIds: arrayRemove(user.uid) }, { merge: true });
}

export async function removePodMember(podId: string, uid: string): Promise<void> {
  requireUser();
  await deleteDoc(memberRef(podId, uid));
  await setDoc(podRef(podId), { memberIds: arrayRemove(uid) }, { merge: true });
}

export async function renamePod(podId: string, newName: string | null | undefined): Promise<void> {
  requireUser();
  const renamed = (newName || "").trim() || "Our Pod";
  requireText(renamed, PM_LIMITS.podName, "Pod name");
  await setDoc(podRef(podId), { name: renamed }, { merge: true });
}

export async function regenerateInviteCode(podId: string): Promise<string> {
  requireUser();
  const newCode = generateInviteCode();
  await setDoc(podRef(podId), { inviteCode: newCode }, { merge: true });
  return newCode;
}

export async function promoteToCoLeader(podId: string, uid: string): Promise<void> {
  requireUser();
  await setDoc(podRef(podId), { coLeaderIds: arrayUnion(uid) }, { merge: true });
  await setDoc(memberRef(podId, uid), { role: "co-leader" }, { merge: true });
}

export async function transferLeadership(podId: string, newLeaderUid: string): Promise<void> {
  const oldLeaderUid = requireUser().uid;
  await setDoc(
    podRef(podId),
    { leaderId: newLeaderUid, coLeaderIds: arrayUnion(oldLeaderUid) },
    { merge: true },
  );
  await setDoc(memberRef(podId, newLeaderUid), { role: "leader" }, { merge: true });
  await setDoc(memberRef(podId, oldLeaderUid), { role: "co-leader" }, { merge: true });
}

export async function deletePod(podId: string): Promise<void> {
  requireUser();
  const members = await loadPodMembers(podId);
  for (const m of members) {
    await deleteDoc(memberRef(podId, m.uid));
  }
  await deleteDoc(podRef(podId));
}
