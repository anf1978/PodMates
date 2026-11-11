// Pod-scoped history and feedback. Cloud reads/writes go directly through repositories.
import * as chronicles from "../../services/cloud/chronicles";
import { loadPodMembers } from "../../services/cloud/members";
import { getCurrentUser } from "../../services/cloud/session";
import { PM_LIMITS } from "../../services/cloud/limits";
import { reportError } from "../../services/report-error";
import { render } from "../../ui/html";
import { openTadOverlay, closeTryADeckModal } from "../../ui/tad-modal";
import { showToast } from "../../ui/toast";
import { feedbackTemplate, notesTemplate, ratingTemplate } from "./dialogs";
import { emptyState, chronicleDeck, type ChroniclesState } from "./state";
import { historyTemplate, panelTemplate } from "./view";
import "./chronicles.css";

export interface ChroniclesRuntime {
  podId: () => string | null;
  requireAccount: (what: string) => boolean;
  confirm: (message: string, action: () => Promise<void>) => void;
  confirmDelete: (message: string, action: () => Promise<void>) => void;
}

let runtime: ChroniclesRuntime;
let state: ChroniclesState = emptyState();
let refreshVersion = 0;

export function configureChronicles(value: ChroniclesRuntime): void {
  runtime = value;
}

export function renderMatchLog(): void {
  const area = document.getElementById("matchLogArea");
  if (area) render(historyTemplate(state, openChronicleNotesEditor, confirmDeleteChronicle), area);
}

export async function refreshCloudChroniclesCache(): Promise<void> {
  const version = ++refreshVersion;
  const podId = runtime.podId();
  const uid = getCurrentUser()?.uid || null;
  const next = emptyState(uid);
  if (uid && podId) {
    try {
      next.entries = await chronicles.loadAllChronicles(podId);
    } catch (error) {
      reportError(error, { operation: "cloud" });
    }
    try {
      const members = await loadPodMembers(podId);
      next.role = members.find((member) => member.uid === uid)?.role || "member";
    } catch (error) {
      reportError(error, { operation: "cloud" });
    }
  }
  // A slow read from the previous pod/account must not replace the current journal.
  if (
    version !== refreshVersion ||
    podId !== runtime.podId() ||
    uid !== (getCurrentUser()?.uid || null)
  )
    return;
  state = next;
  renderMatchLog();
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function openChronicleNotesEditor(entryId: string): void {
  const entry = state.entries.find((item) => item.id === entryId);
  const podId = runtime.podId();
  if (!entry || !podId) return;
  const { modal } = openTadOverlay({ modalStyle: "max-width:460px" });
  render(
    notesTemplate(entry, PM_LIMITS.notes, closeTryADeckModal, async () => {
      const input = modal.querySelector<HTMLTextAreaElement>("#chronicleNotesInput")!;
      const button = modal.querySelector<HTMLButtonElement>("#chronicleNotesSaveBtn")!;
      const status = modal.querySelector<HTMLElement>("#chronicleNotesStatus")!;
      button.disabled = true;
      status.className = "status chronicles-notes-status";
      status.textContent = "Saving…";
      try {
        await chronicles.updateChronicleNotes(podId, entryId, input.value);
        if (modal.isConnected) closeTryADeckModal();
        showToast("Notes saved.");
        await refreshCloudChroniclesCache();
      } catch (error) {
        reportError(error, { operation: "cloud", userTriggered: true });
        status.className = "status err chronicles-notes-status";
        status.textContent = "Could not save: " + errorMessage(error);
        button.disabled = false;
      }
    }),
    modal,
  );
  modal.querySelector<HTMLTextAreaElement>("#chronicleNotesInput")?.focus();
}

function confirmDeleteChronicle(entryId: string): void {
  const entry = state.entries.find((item) => item.id === entryId);
  const podId = runtime.podId();
  if (!entry || !podId) return;
  const what = (entry.decks || [])
    .map(chronicleDeck)
    .map((deck) => deck.commander || deck.name)
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
  runtime.confirmDelete(
    `Delete this Chronicle entry${entry.date ? " from " + entry.date : ""}${what ? " (" + what + ")" : ""}? Its notes and ratings go with it, and this can't be undone. Are you sure?`,
    async () => {
      try {
        await chronicles.deleteChronicleEntry(podId, entryId);
        showToast("Entry deleted.");
        await refreshCloudChroniclesCache();
      } catch (error) {
        reportError(error, { operation: "cloud", userTriggered: true });
        showToast("Could not delete: " + errorMessage(error));
      }
    },
  );
}

function clearHistory(): void {
  if (!runtime.requireAccount("chronicles")) return;
  const podId = runtime.podId();
  if (!podId) return;
  if (state.role !== "leader" && state.role !== "co-leader") {
    showToast(
      "Only the pod's leaders can clear all Chronicles. You can still delete entries from battles you played in.",
    );
    return;
  }
  runtime.confirm(
    "Clear all Chronicles entries for this pod? This cannot be undone, and affects everyone in the pod.",
    async () => {
      try {
        await chronicles.clearAllChronicles(podId);
        await refreshCloudChroniclesCache();
      } catch (error) {
        reportError(error, { operation: "cloud", userTriggered: true });
        showToast("Could not clear: " + errorMessage(error));
      }
    },
  );
}

export function showFeedbackSurvey(podId: string, chronicleId: string): void {
  let fun = 0;
  let accuracy = 0;
  const { modal } = openTadOverlay();
  render(
    feedbackTemplate(closeTryADeckModal, async () => {
      const bestMoment = modal.querySelector<HTMLTextAreaElement>("#bestMomentInput")!.value.trim();
      try {
        await chronicles.addChronicleFeedback(podId, chronicleId, {
          fun: fun || null,
          accuracy: accuracy || null,
          bestMoment,
        });
        if (modal.isConnected) closeTryADeckModal();
        showToast("Thanks for the feedback!");
      } catch (error) {
        reportError(error, { operation: "cloud", userTriggered: true });
        const status = modal.querySelector<HTMLElement>("#feedbackStatus")!;
        status.textContent = "Could not save: " + errorMessage(error);
        status.className = "status err chronicles-feedback-status";
      }
    }),
    modal,
  );
  const funRow = modal.querySelector<HTMLElement>("#funRatingRow")!;
  const accuracyRow = modal.querySelector<HTMLElement>("#accuracyRatingRow")!;
  const setFun = (rating: number): void => {
    fun = rating;
    render(ratingTemplate(fun, setFun), funRow);
  };
  const setAccuracy = (rating: number): void => {
    accuracy = rating;
    render(ratingTemplate(accuracy, setAccuracy), accuracyRow);
  };
  setFun(fun);
  setAccuracy(accuracy);
}

export function mount(): void {
  const panel = document.getElementById("matchHistoryPanel");
  if (!panel) return;
  render(panelTemplate(clearHistory), panel);
  renderMatchLog();
}
