// Changes this person's display name on their Firebase Auth profile AND in every
// pods/{podId}/members/{uid} snapshot they're already in. Both are self-writes.
import { setDoc, updateProfile } from "./firebase";
import { PM_LIMITS } from "./limits";
import { findNameConflict, memberRef } from "./members";
import { loadMyPods } from "./pods";
import { requireUser } from "./session";
import type { PodDoc, WithId } from "./types";
import { reportError } from "../report-error";

export async function updateMyDisplayName(name: string | null | undefined): Promise<void> {
  const user = requireUser();
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Enter a display name first.");
  if (trimmed.length > PM_LIMITS.displayName)
    throw new Error(`Display name must be ${PM_LIMITS.displayName} characters or fewer.`);
  let pods: Array<WithId<PodDoc>> = [];
  try {
    pods = await loadMyPods();
  } catch (err) {
    reportError(err, { operation: "cloud" });
    // the name is still checked against whichever pods did load
  }
  // Refuse the new name if a member of any of my pods already has it -- BEFORE anything is
  // changed, so a refusal leaves the old name intact.
  const clashes: string[] = [];
  for (const p of pods) {
    const hit = await findNameConflict(p.id, trimmed, user.uid);
    if (hit) clashes.push(p.name || "a pod");
  }
  if (clashes.length) {
    throw new Error(
      `Someone in ${clashes
        .slice(0, 3)
        .map((n) => '"' + n + '"')
        .join(
          ", ",
        )}${clashes.length > 3 ? " and more" : ""} already uses the name "${trimmed}". Please pick a different one so nobody gets mixed up.`,
    );
  }
  await updateProfile(user, { displayName: trimmed });
  await Promise.all(
    pods.map((p) =>
      setDoc(memberRef(p.id, user.uid), { displayName: trimmed }, { merge: true }).catch(
        (err: unknown) => reportError(err, { operation: "cloud" }),
      ),
    ),
  );
}
