// Deck notes templates: the primer header at the top of View Deck, the note button on each card, the
// card-note and primer editors, the read-only note, and the copy dialog.
import { html, nothing, type TemplateResult } from "../../ui/html";
import { PM_LIMITS } from "../../services/cloud/limits";
import { NOTE_ROLES } from "../../services/cloud/deck-notes";
import type { CardNote, DeckNotesDoc, NoteRole } from "../../services/cloud/types";
import { ROLE_LABELS } from "./state";

/** A small pencil-on-page icon; decorative (the button carries the name). */
export const noteIcon = () =>
  html`<svg class="dn-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M4 3h8l4 4v10H4z" fill="none" stroke="currentColor" stroke-width="1.6" />
    <path d="M7 10h6M7 13h4" stroke="currentColor" stroke-width="1.6" />
  </svg>`;

export type HeaderMode =
  | { kind: "loading" }
  | { kind: "unsaved" }
  | { kind: "hidden" }
  | {
      kind: "notes";
      owner: boolean;
      notes: DeckNotesDoc;
      removed: [string, CardNote][];
      expanded: boolean;
    };

export interface HeaderActions {
  toggle(): void;
  editPrimer(): void;
  copy(): void;
  open(name: string): void;
}

export function headerTemplate(mode: HeaderMode, actions: HeaderActions): TemplateResult {
  if (mode.kind === "hidden") return html``;
  if (mode.kind === "loading") return html`<p class="dn-hint">Loading notes…</p>`;
  if (mode.kind === "unsaved")
    return html`<p class="dn-hint">Save this deck to add a primer and card notes.</p>`;
  const { owner, notes, removed, expanded } = mode;
  const primer = notes.primer.trim();
  const hasCardNotes = Object.keys(notes.cards).length > 0;
  if (!owner && !primer && !hasCardNotes) return html``;
  const long = primer.length > 320 || primer.split("\n").length > 4;
  return html`<section class="dn-head" aria-label="Deck notes">
    ${
      primer
        ? html`<h3 class="dn-primer-title">Deck Primer</h3>
            <div class=${`dn-primer-text${long && !expanded ? " dn-clamped" : ""}`}>${primer}</div>
            ${
              long
                ? html`<button type="button" class="dn-link" @click=${actions.toggle}>
                    ${expanded ? "Show less" : "Read more"}
                  </button>`
                : nothing
            }`
        : nothing
    }
    ${
      owner
        ? html`<div class="row dn-actions">
              <button type="button" id="dnPrimerBtn" class="ghost" @click=${actions.editPrimer}>
                ${primer ? "Edit primer" : "Write a primer"}
              </button>
              <button type="button" id="dnCopyBtn" class="ghost" @click=${actions.copy}>
                Copy deck, primer and notes
              </button>
            </div>
            <p class="dn-hint dn-owner-hint">
              Tap ${noteIcon()} on any card to say why it's in the deck.
            </p>`
        : hasCardNotes
          ? html`<p class="dn-hint">
              Cards with ${noteIcon()} in gold have the crafter's notes. Tap to read.
            </p>`
          : nothing
    }
    ${
      removed.length
        ? html`<details class="dn-removed">
            <summary>${`Notes on cards no longer in the deck (${removed.length})`}</summary>
            <ul>
              ${removed.map(
                ([name]) =>
                  html`<li>
                    <button type="button" class="dn-link" @click=${() => actions.open(name)}>
                      ${name}
                    </button>
                  </li>`,
              )}
            </ul>
          </details>`
        : nothing
    }
  </section>`;
}

/** The note button on a card: faint for the owner when empty, gold when the card has a note. */
export function noteButton(name: string, has: boolean, open: () => void): TemplateResult {
  return html`<button
    type="button"
    class=${`dn-note-btn${has ? " dn-has" : ""}`}
    aria-label=${`${has ? "Note" : "Add a note"} for ${name}`}
    title=${has ? "Note" : "Add a note"}
    @click=${open}
  >
    ${noteIcon()}
  </button>`;
}

export interface EditorActions {
  close(): void;
  toggleRole(role: NoteRole): void;
  save(text: string): void;
  remove(): void;
}

export function editorTemplate(
  name: string,
  note: CardNote | null,
  roles: readonly NoteRole[],
  busy: boolean,
  error: string,
  actions: EditorActions,
): TemplateResult {
  const text = () => document.querySelector<HTMLTextAreaElement>("#dnNoteText")?.value ?? "";
  return html`<button class="tad-close" id="tadNoteCloseBtn" @click=${actions.close}>
      Close ×
    </button>
    <h2 class="dn-title">${name}</h2>
    <p class="dn-sub">Why is this card in the deck? Pick any that fit, then add a few words.</p>
    <div class="dn-chips" role="group" aria-label="Roles">
      ${NOTE_ROLES.map(
        (role) =>
          html`<button
            type="button"
            class=${`dn-chip${roles.includes(role) ? " dn-chip-on" : ""}`}
            aria-pressed=${roles.includes(role) ? "true" : "false"}
            @click=${() => actions.toggleRole(role)}
          >
            ${ROLE_LABELS[role]}
          </button>`,
      )}
    </div>
    <textarea
      id="dnNoteText"
      class="dn-textarea"
      rows="6"
      maxlength=${PM_LIMITS.cardNote}
      aria-label="Note"
      placeholder="For example: turn-two ramp that powers out the commander"
      .value=${note?.text ?? ""}
    ></textarea>
    ${error ? html`<p class="status err dn-error">${error}</p>` : nothing}
    <div class="row dn-buttons">
      ${
        note
          ? html`<button type="button" class="ghost" ?disabled=${busy} @click=${actions.remove}>
              Delete note
            </button>`
          : nothing
      }
      <button
        type="button"
        id="dnNoteSaveBtn"
        ?disabled=${busy}
        @click=${() => actions.save(text())}
      >
        ${busy ? "Saving…" : "Save note"}
      </button>
    </div>`;
}

export function readNoteTemplate(name: string, note: CardNote, close: () => void): TemplateResult {
  return html`<button class="tad-close" id="tadNoteCloseBtn" @click=${close}>Close ×</button>
    <h2 class="dn-title">${name}</h2>
    ${
      note.roles.length
        ? html`<div class="dn-chips">
            ${note.roles.map((role) => html`<span class="dn-chip dn-chip-on">${ROLE_LABELS[role]}</span>`)}
          </div>`
        : nothing
    }
    ${note.text ? html`<p class="dn-note-text">${note.text}</p>` : nothing}`;
}

export interface PrimerActions {
  close(): void;
  save(primer: string, share: boolean): void;
}

export function primerTemplate(
  notes: DeckNotesDoc,
  busy: boolean,
  error: string,
  actions: PrimerActions,
): TemplateResult {
  return html`<button class="tad-close" id="tadNoteCloseBtn" @click=${actions.close}>
      Close ×
    </button>
    <h2 class="dn-title">Deck Primer</h2>
    <p class="dn-sub">
      How the deck plays, what it's trying to do and how it wins. Podmates who can see the deck can
      read it.
    </p>
    <textarea
      id="dnPrimerText"
      class="dn-textarea dn-primer-input"
      rows="14"
      maxlength=${PM_LIMITS.deckPrimer}
      aria-label="Deck primer"
      .value=${notes.primer}
    ></textarea>
    <label class="dn-share">
      <input id="dnShareTuning" type="checkbox" .checked=${notes.shareForTuning} />
      <span>Share my notes and decklist to help tune Spark</span>
    </label>
    ${error ? html`<p class="status err dn-error">${error}</p>` : nothing}
    <div class="row dn-buttons">
      <button type="button" class="ghost" ?disabled=${busy} @click=${actions.close}>Cancel</button>
      <button
        type="button"
        id="dnPrimerSaveBtn"
        ?disabled=${busy}
        @click=${() =>
          actions.save(
            document.querySelector<HTMLTextAreaElement>("#dnPrimerText")?.value ?? "",
            document.querySelector<HTMLInputElement>("#dnShareTuning")?.checked === true,
          )}
      >
        ${busy ? "Saving…" : "Save primer"}
      </button>
    </div>`;
}

export function copyTemplate(text: string, status: string, copy: () => void, close: () => void) {
  return html`<button class="tad-close" id="tadNoteCloseBtn" @click=${close}>Close ×</button>
    <h2 class="dn-title">Deck, primer and notes</h2>
    <p class="dn-sub">Everything in one piece of text, ready to paste.</p>
    <textarea
      class="dn-textarea dn-copy-text"
      rows="12"
      readonly
      aria-label="Deck, primer and notes"
      .value=${text}
    ></textarea>
    <div class="row dn-buttons">
      <button type="button" id="dnCopyTextBtn" @click=${copy}>Copy</button>
      <span class="dn-copy-status" role="status">${status}</span>
    </div>`;
}
