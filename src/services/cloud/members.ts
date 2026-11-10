// pods/{podId}/members/{uid}: a per-pod snapshot of each member's display name and role.
import { collection, db, doc, getDocs } from "./firebase";
import { requireUser } from "./session";
import { capCheckTimeout, nameKey } from "./shared";
import type { MemberDoc, PodMember } from "./types";

export const membersCol = (podId: string) => collection(db, "pods", podId, "members");
export const memberRef = (podId: string, uid: string) => doc(db, "pods", podId, "members", uid);

// Returns the member already using this name in the pod (or null). A failed lookup returns null
// -- a slow network must never block someone from joining; the check is a courtesy, not a
// security boundary.
export async function findNameConflict(
  podId: string,
  name: unknown,
  exceptUid: string,
): Promise<(MemberDoc & { uid: string }) | null> {
  const key = nameKey(name);
  if (!key) return null;
  try {
    const snap = await capCheckTimeout(getDocs(membersCol(podId)));
    let hit: (MemberDoc & { uid: string }) | null = null;
    snap.forEach((d) => {
      const data = (d.data() || {}) as MemberDoc;
      if (!hit && d.id !== exceptUid && nameKey(data.displayName) === key)
        hit = { uid: d.id, ...data };
    });
    return hit;
  } catch (e) {
    console.warn("Name check skipped:", (e as Error).message);
    return null;
  }
}

export async function loadPodMembers(podId: string): Promise<PodMember[]> {
  requireUser();
  const snap = await getDocs(membersCol(podId));
  const members: PodMember[] = [];
  snap.forEach((d) => members.push({ uid: d.id, ...(d.data() as MemberDoc) } as PodMember));
  members.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  // Pods that already had two members with the same name before the uniqueness check existed keep
  // their stored names, but get numbered labels ("Alex (1)", "Alex (2)") for display.
  const byKey: Record<string, PodMember[]> = {};
  members.forEach((m) => {
    (byKey[nameKey(m.displayName)] = byKey[nameKey(m.displayName)] || []).push(m);
  });
  members.forEach((m) => {
    const group = byKey[nameKey(m.displayName)];
    m.nameClash = group.length > 1 && !!nameKey(m.displayName);
    m.displayLabel = m.nameClash
      ? `${String(m.displayName).trim()} (${group.indexOf(m) + 1})`
      : m.displayName || "";
  });
  return members;
}
