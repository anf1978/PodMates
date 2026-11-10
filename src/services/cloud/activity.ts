// pods/{podId}/activity: one small record per event, feeding the in-app notification bell.
// Best effort: a failure here must never get in the way of the action that triggered it.
import {
  collection,
  db,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from "./firebase";
import { getCurrentUser } from "./session";
import { actorName, clampText } from "./shared";
import type { ActivityDoc, ActivityOptions, WithId } from "./types";
import { loadUserDoc } from "./users";

export type ActivityItem = WithId<ActivityDoc> & { podId: string };

export const activityCol = (podId: string) => collection(db, "pods", podId, "activity");

async function activityPodIds(uid: string): Promise<string[]> {
  try {
    const user = await loadUserDoc(uid);
    return user ? (user.podIds || []).slice(0, 40) : [];
  } catch {
    return [];
  }
}

function activityRecord(
  type: string,
  subject: unknown,
  ref: unknown,
  to: string[] | undefined,
): ActivityDoc | null {
  const user = getCurrentUser();
  if (!user) return null;
  const data: ActivityDoc = {
    type,
    by: user.uid,
    byName: actorName(user, "Someone", 80),
    subject: clampText(String(subject || ""), 160),
    createdAt: Date.now(),
  };
  if (ref) data.ref = clampText(String(ref), 80);
  if (to && to.length) data.to = to.slice(0, 12);
  return data;
}

// Written into each pod the actor belongs to, or the given pods.
export async function logActivity(
  type: string,
  subject: unknown,
  opts?: ActivityOptions,
): Promise<void> {
  try {
    const user = getCurrentUser();
    if (!user) return;
    const o = opts || {};
    const podIds = o.podIds || (await activityPodIds(user.uid));
    for (const podId of podIds) {
      const data = activityRecord(type, subject, o.ref, o.to);
      if (!data) return;
      await setDoc(doc(activityCol(podId)), data).catch(() => {});
    }
  } catch {
    // best effort
  }
}

export function watchActivity(podId: string, cb: (items: ActivityItem[]) => void): Unsubscribe {
  if (!getCurrentUser()) return () => {};
  const q = query(activityCol(podId), orderBy("createdAt", "desc"), limit(30));
  return onSnapshot(
    q,
    (snap) => {
      const out: ActivityItem[] = [];
      snap.forEach((d) => out.push({ id: d.id, podId, ...(d.data() as ActivityDoc) }));
      cb(out);
    },
    () => cb([]),
  );
}

// Writes one bell entry addressed to specific people. Returns true only if it was really written,
// so the screen can say honestly whether invites went out.
export async function notify(
  type: string,
  subject: unknown,
  podId: string,
  ref?: unknown,
  toUids?: string[],
): Promise<boolean> {
  try {
    if (!getCurrentUser() || !podId) return false;
    const data = activityRecord(type, subject, ref, toUids);
    if (!data) return false;
    await setDoc(doc(activityCol(podId)), data);
    return true;
  } catch {
    return false;
  }
}
