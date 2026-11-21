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
    const { modal } = openTadOverlay({
      stacked: true,
      id: NOTE_OVERLAY,
      modalStyle: "max-width:440px",
    });
    const close = () => closeModal(document.getElementById(NOTE_OVERLAY));
    if (!owner) {
      if (existing) render(readNoteTemplate(name, existing, close), modal);
      return;
    }
    let roles: NoteRole[] = [...(existing?.roles ?? [])];
    let busy = false;
    let error = "";
    const save = async (note: { roles: NoteRole[]; text: string } | null) => {
      busy = true;
      error = "";
      draw();
      try {
        updated(await saveCardNote(ref, name, note));
        close();
      } catch (err) {
        reportError(err, { operation: "cloud", userTriggered: true });
        busy = false;
        error = "Could not save: " + errorText(err);
        draw();
      }
    };
    const draw = () =>
      render(
        editorTemplate(name, existing, roles, busy, error, {
          close,
          toggleRole(role) {
            roles = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
            draw();
          },
          save: (text) => void save({ roles, text }),
          remove: () => void save(null),
        }),
        modal,
      );
    draw();
  }

  function editPrimer(): void {
    if (!ref || !notes || !owner) return;
    const { modal } = openTadOverlay({ stacked: true, id: NOTE_OVERLAY });
    const close = () => closeModal(document.getElementById(NOTE_OVERLAY));
    let busy = false;
    let error = "";
    const current = notes;
    const draw = () =>
      render(
        primerTemplate(current, busy, error, {
          close,
          async save(primer, share) {
            busy = true;
            error = "";
            draw();
            try {
              updated(await saveDeckPrimer(ref, primer, share));
              close();
            } catch (err) {
              reportError(err, { operation: "cloud", userTriggered: true });
              busy = false;
              error = "Could not save: " + errorText(err);
              draw();
            }
          },
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
