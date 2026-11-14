// Deck Log: the history of the saved deck on the Deck Chart, under Structure & Legality. Each finished
// chart of a saved deck counts once (the owner's charts or a podmate's view), then the panel shows
// its first save, counts, battles, wins and change log.
import {
  changeDeckWins,
  loadDeckLog,
  recordDeckChart,
  setDeckChangeNote,
} from "../../services/cloud/deck-log";
import { getCurrentUser } from "../../services/cloud/session";
import { chartedDeck } from "../../services/deck-form";
import { on } from "../../services/events";
import { reportError } from "../../services/report-error";
import { render } from "../../ui/html";
import type { PanelState } from "./state";
import { panelView, type DeckLogActions } from "./view";

export interface DeckLogFeature {
  /** Counts the chart (for a saved deck) and shows its log. Resolves when the panel is drawn. */
  refresh(): Promise<void>;
  destroy(): void;
}

export function mount(panel: HTMLElement): DeckLogFeature {
  const area = panel.querySelector<HTMLElement>("#deckLogArea") || panel;
  let state: PanelState = { kind: "unsaved" };
  let generation = 0;

  const draw = () => render(panelView(state, actions, Date.now()), area);
  const showing = () => (state.kind === "log" ? state : null);

  const actions: DeckLogActions = {
    win(delta) {
      const current = showing();
      if (!current?.mine || current.busy) return;
      state = { ...current, busy: true, error: null };
      draw();
      changeDeckWins(current.log.ref, delta)
        .then((wins) => {
          const latest = showing();
          if (latest?.log.ref === current.log.ref)
            state = {
              ...latest,
              busy: false,
              log: { ...latest.log, deck: { ...latest.log.deck, wins } },
            };
        })
        .catch((error: unknown) => {
          reportError(error, { operation: "cloud", userTriggered: true });
          const latest = showing();
          if (latest)
            state = { ...latest, busy: false, error: "Couldn't update the wins. Try again." };
        })
        .finally(draw);
    },
    editNote(changeId) {
      const current = showing();
      if (!current?.mine) return;
      state = { ...current, editing: changeId, error: null };
      draw();
    },
    saveNote(changeId, note) {
      const current = showing();
      if (!current?.mine || current.busy) return;
      state = { ...current, busy: true };
      draw();
      setDeckChangeNote(current.log.ref, changeId, note)
        .then(() => {
          const latest = showing();
          if (!latest) return;
          const clean = note.trim().slice(0, 280);
          const changes = latest.log.changes.map((c) =>
            c.id === changeId ? { ...c, note: clean } : c,
          );
          state = { ...latest, busy: false, editing: null, log: { ...latest.log, changes } };
        })
        .catch((error: unknown) => {
          reportError(error, { operation: "cloud", userTriggered: true });
          const latest = showing();
          if (latest)
            state = { ...latest, busy: false, error: "Couldn't save the note. Try again." };
        })
        .finally(draw);
    },
  };

  async function refresh(): Promise<void> {
    const request = ++generation;
    panel.hidden = false;
    const user = getCurrentUser();
    const deck = chartedDeck();
    if (!user || user.isAnonymous) state = { kind: "signed-out" };
    else if (!deck) state = { kind: "unsaved" };
    else state = { kind: "loading", name: deck.name || "this deck" };
    draw();
    if (state.kind !== "loading" || !deck || !user) return;
    const ref = { uid: deck.uid, id: deck.id };
    await recordDeckChart(ref);
    const log = await loadDeckLog(ref).catch((error: unknown) => {
      reportError(error, { operation: "cloud" });
      return null;
    });
    if (request !== generation) return;
    state = log
      ? {
          kind: "log",
          name: deck.name || log.deck.deckName,
          log,
          mine: user.uid === deck.uid,
          editing: null,
          busy: false,
          error: null,
        }
      : { kind: "missing", name: deck.name || "this deck" };
    draw();
  }

  const off = on("chart:done", () => void refresh());
  return {
    refresh,
    destroy() {
      generation++;
      off();
    },
  };
}
