// Pod-scoped history and feedback. Cloud reads/writes go directly through repositories.
import * as chronicles from "../../services/cloud/chronicles";
import { loadPodMembers } from "../../services/cloud/members";
import { getCurrentUser } from "../../services/cloud/session";
import { PM_LIMITS } from "../../services/cloud/limits";
import { logBattle } from "../../services/cloud/gatherings";
import { reportError } from "../../services/report-error";
import { render } from "../../ui/html";
import { openTadOverlay, closeTryADeckModal } from "../../ui/tad-modal";
import { showToast } from "../../ui/toast";
import { saveSparkCheck } from "../../services/cloud/deck-notes";
import type { DeckRef } from "../../services/cloud/deck-log";
import type { SparkVerdict } from "../../services/cloud/types";
import {
  feedbackTemplate,
  notesTemplate,
  ratingTemplate,
  sparkCheckTemplate,
  type SurveyDeck,
} from "./dialogs";
import {
  emptyState,
  chronicleDeck,
  battleEntry,
  type ChroniclesState,
  type ChronicleBattle,
  type ChronicleBattleDeck,
} from "./state";
import { historyTemplate, panelTemplate } from "./view";
import { configureBattle, type BattleRuntime } from "./battle";
import "./chronicles.css";

export interface ChroniclesRuntime extends BattleRuntime {
  podId: () => string | null;
  requireAccount: (what: string) => boolean;
  confirm: (message: string, action: () => Promise<void>) => void;
  confirmDelete: (message: string, action: () => Promise<void>) => void;
  battle: () => { context: ChronicleBattle; decks: ChronicleBattleDeck[] } | null;
  battleLogged: (context: ChronicleBattle, chronicleId: string) => boolean;
}

let runtime: ChroniclesRuntime;
let state: ChroniclesState = emptyState();
let refreshVersion = 0;

export function configureChronicles(value: ChroniclesRuntime): void {
  runtime = value;
  configureBattle(value, showFeedbackSurvey, runLogBattle);
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

export async function runLogBattle(): Promise<void> {
  const battle = runtime.battle();
  if (!battle) return;
  const { context, decks } = battle;
  try {
    const chronicleId = await logBattle(
      context.podId,
      context.gatheringId,
      battleEntry(context, decks),
    );
    if (runtime.battleLogged(context, chronicleId)) showFeedbackSurvey(context.podId, chronicleId);
  } catch (error) {
    reportError(error, { operation: "cloud", userTriggered: true });
    showToast("Could not log the battle: " + errorMessage(error));
  }
}

/** The signed-in player's own saved deck in the current battle, for the Spark question. */
export function myBattleDeck(): (SurveyDeck & { ref: DeckRef }) | null {
  const me = getCurrentUser()?.uid;
  const deck = me ? runtime?.battle()?.decks.find((d) => d.deckRef?.uid === me) : undefined;
  if (!deck?.deckRef || !Number.isFinite(deck.commandSpark)) return null;
  return {
    ref: { uid: deck.deckRef.uid, id: deck.deckRef.id },
    name: deck.name || deck.commanderLabel || "your deck",
    spark: deck.commandSpark,
  };
}

export function showFeedbackSurvey(
  podId: string,
  chronicleId: string,
  mine: (SurveyDeck & { ref: DeckRef }) | null = myBattleDeck(),
): void {
  let fun = 0;
  let accuracy = 0;
  let verdict: SparkVerdict | null = null;
  const { modal } = openTadOverlay();
  render(
    feedbackTemplate(
      closeTryADeckModal,
      async () => {
        const bestMoment = modal
          .querySelector<HTMLTextAreaElement>("#bestMomentInput")!
          .value.trim();
        try {
          // The Spark answer goes on the player's own deck (its Deck Log); the ratings on the battle.
          // Best effort: a failed Spark answer never blocks the battle's ratings.
          if (mine && verdict)
            await saveSparkCheck(mine.ref, chronicleId, podId, verdict, mine.spark).catch(
              (error: unknown) => reportError(error, { operation: "cloud" }),
            );
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
      },
      mine,
    ),
    modal,
  );
  const sparkArea = modal.querySelector<HTMLElement>("#sparkCheckArea");
  const setVerdict = (next: SparkVerdict): void => {
    verdict = next;
    if (mine && sparkArea) render(sparkCheckTemplate(mine, verdict, setVerdict), sparkArea);
  };
  if (mine && sparkArea) render(sparkCheckTemplate(mine, verdict, setVerdict), sparkArea);
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
