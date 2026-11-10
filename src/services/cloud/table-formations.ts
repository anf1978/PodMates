// pods/{podId}/tableFormations: Game Night's saved 6-seat lineups, shared with the whole pod.
// Named "tableFormations" to avoid any collision with the pods collection itself.
import { collection, db, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "./firebase";
import { PM_LIMITS } from "./limits";
import { requireUser } from "./session";
import { actorName, countDocs, docExistsSafe, requireText, safeDocId } from "./shared";
import type { TableFormationDoc } from "./types";

export const formationsCol = (podId: string) => collection(db, "pods", podId, "tableFormations");
const formationRef = (podId: string, name: string) =>
  doc(db, "pods", podId, "tableFormations", safeDocId(name));

export async function saveTableFormation(
  podId: string,
  name: string,
  entry: { seats?: unknown[]; savedAt?: number },
): Promise<void> {
  const user = requireUser();
  if (!podId) throw new Error("No pod selected");
  const L = PM_LIMITS;
  requireText(name, L.formationName, "Lineup name");
  const ref = formationRef(podId, name);
  if (L.maxFormationsPerPod && !(await docExistsSafe(ref))) {
    const haveFormations = await countDocs(formationsCol(podId));
    if (haveFormations >= L.maxFormationsPerPod)
      throw new Error(
        `This pod has reached its limit of ${L.maxFormationsPerPod} saved lineups. Delete an old one first.`,
      );
  }
  await setDoc(ref, {
    name,
    seats: (entry.seats || []).slice(0, 6),
    savedAt: entry.savedAt || Date.now(),
    savedBy: actorName(user, "Someone", L.displayName),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTableFormation(podId: string, name: string): Promise<void> {
  requireUser();
  if (!podId) throw new Error("No pod selected");
  await deleteDoc(formationRef(podId, name));
}

export async function loadAllTableFormations(
  podId: string,
): Promise<Record<string, Pick<TableFormationDoc, "seats" | "savedAt" | "savedBy">>> {
  requireUser();
  if (!podId) return {};
  const snap = await getDocs(formationsCol(podId));
  const out: Record<string, Pick<TableFormationDoc, "seats" | "savedAt" | "savedBy">> = {};
  snap.forEach((docSnap) => {
    const d = docSnap.data() as TableFormationDoc;
    out[d.name] = { seats: d.seats, savedAt: d.savedAt, savedBy: d.savedBy };
  });
  return out;
}
