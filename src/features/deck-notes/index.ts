// Deck notes in View Deck: the primer at the top and a note button on each card. The owner of a saved
// deck writes them; podmates who can see the deck read them. The page wiring (src/app/card-viewer.ts)
// passes the deck and plugs the header and buttons into View Deck through `DeckNotesExtras`.
import "./deck-notes.css";
import { nothing, render } from "../../ui/html";
import { closeModal } from "../../ui/modal";
import { openTadOverlay } from "../../ui/tad-modal";
import { reportError } from "../../services/report-error";
import {
  loadDeckNotes,
  loadSparkChecks,
  saveCardNote,
  saveDeckPrimer,
} from "../../services/cloud/deck-notes";
import type { DeckRef } from "../../services/cloud/deck-log";
import type { DeckNotesDoc, NoteRole } from "../../services/cloud/types";
import { notesBundle, removedNotes } from "./state";
import { createAutosaver, type SaveStatus } from "./autosave";
import {
  copyTemplate,
  editorTemplate,
  headerTemplate,
  noteButton,
  primerTemplate,
  readNoteTemplate,
  type HeaderMode,
} from "./view";

export interface DeckNotesTarget {
  /** The saved deck in the form, or null for a pasted, edited or sample list. */
  ref: DeckRef | null;
  /** The signed-in user's id; null when signed out or anonymous. */
  me: string | null;
  deckName: string;
  commander: string;
  list: string;
  /** PodMates' own read of a card in this deck as chips (null when the card data isn't ready). */
  suggest?(name: string): NoteRole[] | null;
}

/** What View Deck draws: a header above the cards and an optional button on each card. */
export interface DeckNotesExtras {
  header(): unknown;
  tile(name: string): unknown;
  /** View Deck hands over its redraw and the card names it shows, in order. */
  attach(redraw: () => void, names: readonly string[]): void;
}

const NOTE_OVERLAY = "tadNoteOverlay";
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function deckNotesExtras(target: DeckNotesTarget): DeckNotesExtras {
  const { ref, me } = target;
  const owner = !!ref && !!me && ref.uid === me;
  let notes: DeckNotesDoc | null = null;
  let state: "loading" | "ready" | "failed" = ref && me ? "loading" : "failed";
  let expanded = false;
  let names: readonly string[] = [];
  let redraw = () => {};

  if (ref && me)
    loadDeckNotes(ref)
      .then((loaded) => {
        notes = loaded;
        state = loaded ? "ready" : "failed";
      })
      .catch((error: unknown) => {
        reportError(error, { operation: "cloud" });
        state = "failed";
      })
      .finally(() => redraw());

  const updated = (next: DeckNotesDoc) => {
    notes = next;
    redraw();
  };

  function mode(): HeaderMode {
    if (!me) return { kind: "hidden" };
    if (!ref) return { kind: "unsaved" };
    if (state === "loading") return { kind: "loading" };
    if (state === "failed" || !notes) return { kind: "hidden" };
    return { kind: "notes", owner, notes, removed: removedNotes(notes, new Set(names)), expanded };
  }

  function openNote(name: string): void {
    if (!ref || !notes) return;
    const existing = notes.cards[name] ?? null;
    // Escape or a tap outside saves anything waiting before the note closes.
    const layer = openTadOverlay({
      stacked: true,
      id: NOTE_OVERLAY,
      modalStyle: "max-width:440px",
      onDismiss: () => void (owner ? finish() : layer.handle.close()),
    });
    const { modal } = layer;
    if (!owner) {
      if (existing)
        render(
          readNoteTemplate(name, existing, () => layer.handle.close()),
          modal,
        );
      return;
    }
    // PodMates' own read starts a new note; an existing note keeps the crafter's choice.
    const suggested = target.suggest?.(name) ?? null;
    let roles: NoteRole[] = [...(existing?.roles ?? suggested ?? [])];
    let text = existing?.text ?? "";
    let status: SaveStatus = "idle";
    let error = "";
    // Nothing is written until the crafter changes something, so just opening a card adds no note.
    const saver = createAutosaver<{ roles: NoteRole[]; text: string } | null>(
      async (note) =>
        updated(
          await saveCardNote(
            ref,
            name,
            note && { ...note, ...(suggested ? { app: suggested } : {}) },
          ),
        ),
      (next, err) => {
        status = next;
        error = err ? errorText(err) : "";
        if (err) reportError(err, { operation: "cloud", userTriggered: true });
        draw();
      },
    );
    const changed = (delay: number) => saver.schedule({ roles: [...roles], text }, delay);
    const finish = async () => {
      await saver.flush();
      if (saver.status() !== "error") layer.handle.close();
    };
    const draw = () =>
      render(
        editorTemplate(name, existing, roles, suggested, status, error, !!notes?.cards[name], {
          close: () => void finish(),
          toggleRole(role) {
            roles = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
            changed(300);
            draw();
          },
          input(next) {
            text = next;
            changed(900);
          },
          remove() {
            saver.cancel();
            saver.schedule(null, 0);
            void saver.flush().then(() => {
              if (saver.status() !== "error") layer.handle.close();
            });
          },
          retry: () => changed(0),
        }),
        modal,
      );
    draw();
  }

  function editPrimer(): void {
    if (!ref || !notes || !owner) return;
    const layer = openTadOverlay({
      stacked: true,
      id: NOTE_OVERLAY,
      onDismiss: () => void finish(),
    });
    const { modal } = layer;
    let status: SaveStatus = "idle";
    let error = "";
    let latest = { primer: notes.primer, share: notes.shareForTuning };
    const current = notes;
    const saver = createAutosaver<{ primer: string; share: boolean }>(
      async ({ primer, share }) => updated(await saveDeckPrimer(ref, primer, share)),
      (next, err) => {
        status = next;
        error = err ? errorText(err) : "";
        if (err) reportError(err, { operation: "cloud", userTriggered: true });
        draw();
      },
    );
    async function finish() {
      await saver.flush();
      if (saver.status() !== "error") layer.handle.close();
    }
    const draw = () =>
      render(
        primerTemplate(current, status, error, {
          close: () => void finish(),
          input(primer, share) {
            const tickChanged = share !== latest.share;
            latest = { primer, share };
            saver.schedule(latest, tickChanged ? 0 : 1200);
          },
          retry: () => saver.schedule(latest, 0),
        }),
        modal,
      );
    draw();
  }

  async function copy(): Promise<void> {
    if (!ref || !notes) return;
    let checks: Awaited<ReturnType<typeof loadSparkChecks>> = [];
    try {
      checks = await loadSparkChecks(ref);
    } catch (err) {
      reportError(err, { operation: "cloud" });
    }
    const text = notesBundle({
      deckName: target.deckName,
      commander: target.commander,
      list: target.list,
      notes,
      checks,
      order: names,
    });
    const { modal } = openTadOverlay({ stacked: true, id: NOTE_OVERLAY });
    const close = () => closeModal(document.getElementById(NOTE_OVERLAY));
    const draw = (status: string) =>
      render(
        copyTemplate(
          text,
          status,
          async () => {
            try {
              await navigator.clipboard.writeText(text);
              draw("Copied.");
            } catch (err) {
              reportError(err, { operation: "deck-export" });
              draw("Could not copy automatically: select the text and copy it.");
            }
          },
          close,
        ),
        modal,
      );
    draw("");
  }

  return {
    header: () =>
      headerTemplate(mode(), {
        toggle() {
          expanded = !expanded;
          redraw();
        },
        editPrimer,
        copy: () => void copy(),
        open: openNote,
      }),
    tile(name) {
      if (state !== "ready" || !notes) return nothing;
      const has = !!notes.cards[name];
      return owner || has ? noteButton(name, has, () => openNote(name)) : nothing;
    },
    attach(next, shown) {
      redraw = next;
      names = shown;
    },
  };
}
