// pods/{podId}/settings/impactCards and pods/{podId}/impactNominations: the pod's proposed changes
// to the Impact-card list. Only differences from the default list are stored, one map entry per
// card, so two Co-Stewards editing different cards never overwrite each other. Used only for the
// separate "Pod view" Power figure, never the main scores.
import {
  collection,
  db,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
  setDoc,
} from "./firebase";
import { logActivity } from "./activity";
import { PM_LIMITS } from "./limits";
import { loadPodDoc } from "./pods";
import { requireUser } from "./session";
import { actorName, clampText } from "./shared";
import type { ImpactChange, ImpactNominationDoc, ImpactSettingsDoc, WithId } from "./types";

export const impactRef = (podId: string) => doc(db, "pods", podId, "settings", "impactCards");
export const nominationsCol = (podId: string) => collection(db, "pods", podId, "impactNominations");

const KEY_PATTERN = /^[a-z0-9_]{1,80}$/;

function requirePodAndKey(podId: string, key?: string): void {
  if (!podId) throw new Error("No pod selected");
  if (key !== undefined && !KEY_PATTERN.test(key))
    throw new Error("That card name cannot be used as a list key.");
}

const impactWho = () => actorName(requireUser(), "Someone", 80);

export async function loadImpactSettings(podId: string): Promise<ImpactSettingsDoc> {
  requireUser();
  if (!podId) return { changes: {} };
  const snap = await getDoc(impactRef(podId));
  return snap.exists() ? (snap.data() as ImpactSettingsDoc) : { changes: {} };
}

export async function setImpactChange(
  podId: string,
  key: string,
  entry: { card?: unknown; action?: unknown } | null,
): Promise<void> {
  const user = requireUser();
  requirePodAndKey(podId, key);
  const ref = impactRef(podId);
  if (entry === null) {
    await setDoc(
      ref,
      { changes: { [key]: deleteField() }, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return;
  }
  const L = PM_LIMITS;
  const cur: Record<string, ImpactChange> = (await loadImpactSettings(podId)).changes || {};
  const keys = Object.keys(cur);
  if (!(key in cur) && keys.length >= (L.impactChanges || 60))
    throw new Error(
      `This pod's list already has ${L.impactChanges || 60} changes. Undo one first.`,
    );
  const adds = keys.filter((k) => cur[k] && cur[k].action === "add").length;
  if (
    entry.action === "add" &&
    !(cur[key] && cur[key].action === "add") &&
    adds >= (L.impactAdds || 15)
  )
    throw new Error(`A pod list can add at most ${L.impactAdds || 15} cards beyond the default.`);
  const change: ImpactChange = {
    card: clampText(entry.card, 200),
    action: entry.action === "add" ? "add" : "remove",
    reason: "",
    by: user.uid,
    byName: impactWho(),
    at: Date.now(),
  };
  await setDoc(ref, { changes: { [key]: change }, updatedAt: serverTimestamp() }, { merge: true });
}

export async function setImpactReason(podId: string, key: string, reason: unknown): Promise<void> {
  requireUser();
  requirePodAndKey(podId, key);
  const change: ImpactChange = {
    reason: clampText(reason, PM_LIMITS.impactReason || 280).trim(),
    reasonBy: impactWho(),
    reasonAt: Date.now(),
  };
  await setDoc(
    impactRef(podId),
    { changes: { [key]: change }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function resetImpactSettings(podId: string): Promise<void> {
  requireUser();
  requirePodAndKey(podId);
  await setDoc(impactRef(podId), {
    changes: {},
    updatedAt: serverTimestamp(),
    resetBy: impactWho(),
  });
}

// Turned-down ideas live in settings/impactCards -> dismissed (leaders write, same rule as the list).
export async function setImpactDismiss(
  podId: string,
  key: string,
  entry: { card?: unknown } | null,
): Promise<void> {
  const user = requireUser();
  requirePodAndKey(podId, key);
  if (entry === null) {
    await setDoc(
      impactRef(podId),
      { dismissed: { [key]: deleteField() }, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return;
  }
  await setDoc(
    impactRef(podId),
    {
      dismissed: {
        [key]: {
          card: clampText(entry.card, 200),
          by: user.uid,
          byName: impactWho(),
          at: Date.now(),
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function clearImpactDismissed(podId: string): Promise<void> {
  requireUser();
  requirePodAndKey(podId);
  await setDoc(
    impactRef(podId),
    { dismissed: deleteField(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// Nominations are one document per card; any member can create their own.
export async function loadNominations(podId: string): Promise<Array<WithId<ImpactNominationDoc>>> {
  requireUser();
  if (!podId) return [];
  const snap = await getDocs(nominationsCol(podId));
  const out: Array<WithId<ImpactNominationDoc>> = [];
  snap.forEach((d) => out.push({ id: d.id, ...(d.data() as ImpactNominationDoc) }));
  out.sort((a, b) => (a.at || 0) - (b.at || 0));
  return out;
}

export async function nominateImpact(
  podId: string,
  key: string,
  entry: { card?: unknown; note?: unknown },
): Promise<void> {
  const user = requireUser();
  requirePodAndKey(podId, key);
  const nomination: ImpactNominationDoc = {
    card: clampText(entry.card, 200),
    note: clampText(entry.note || "", 200).trim(),
    by: user.uid,
    byName: impactWho(),
    at: Date.now(),
  };
  await setDoc(doc(nominationsCol(podId), key), nomination);
  loadPodDoc(podId)
    .then((d) => {
      const to = [d.leaderId]
        .concat(d.coLeaderIds || [])
        .filter((u): u is string => !!u && u !== user.uid);
      if (to.length) return logActivity("nomination", entry.card, { podIds: [podId], to });
    })
    .catch(() => {});
}

export async function withdrawNomination(podId: string, key: string): Promise<void> {
  requireUser();
  requirePodAndKey(podId);
  await deleteDoc(doc(nominationsCol(podId), key));
}
