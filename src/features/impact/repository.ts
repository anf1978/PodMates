// Loads account-scoped Impact state through cloud repositories; stale requests cannot replace a newer pod.
import { loadMyPods } from "../../services/cloud/pods";
import { loadImpactSettings, loadNominations } from "../../services/cloud/impact";
import { getCurrentUser } from "../../services/cloud/session";
import { reportError } from "../../services/report-error";
import { createState, type ImpactState } from "./state";

const STORAGE_KEY = "pm_impact_pod";

function storedPod(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    reportError(error, { operation: "cloud", severity: "warning" });
    return null;
  }
}
function rememberPod(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (error) {
    reportError(error, { operation: "cloud", severity: "warning" });
  }
}
function millis(value: unknown): number | null {
  return value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
    ? value.toMillis()
    : null;
}

export class ImpactRepository {
  state: ImpactState = createState();
  private uid: string | null = null;
  private generation = 0;

  syncAccount(): void {
    const uid = getCurrentUser()?.uid || null;
    if (uid === this.uid) return;
    this.uid = uid;
    this.generation++;
    this.state = createState();
  }

  async load(forcePodId?: string | null, force = false): Promise<boolean> {
    this.syncAccount();
    const uid = this.uid;
    if (!uid) throw new Error("not signed in");
    const version = ++this.generation;
    const state = this.state;
    const active = () => version === this.generation && getCurrentUser()?.uid === uid;
    const pods = state.pods || (await loadMyPods());
    if (!active()) return false;
    state.pods = pods;
    let id = forcePodId || state.podId || storedPod();
    if (!id || !pods.some((p) => p.id === id)) id = pods[0]?.id || null;
    if (!id) {
      state.podId = null;
      state.changes = {};
      state.loadedFor = null;
      state.dismissed = {};
      state.nominations = [];
      state.updatedAt = null;
      return true;
    }
    if (force || state.loadedFor !== id) {
      const data = await loadImpactSettings(id);
      if (!active()) return false;
      state.changes = data.changes || {};
      state.updatedAt = millis(data.updatedAt);
      state.dismissed = data.dismissed && typeof data.dismissed === "object" ? data.dismissed : {};
      state.loadedFor = id;
    }
    state.podId = id;
    rememberPod(id);
    try {
      const nominations = await loadNominations(id);
      if (!active()) return false;
      state.nominations = nominations;
      state.nomOk = true;
    } catch (error) {
      reportError(error, { operation: "cloud" });
      if (!active()) return false;
      state.nominations = [];
      state.nomOk = false;
    }
    return true;
  }
}
