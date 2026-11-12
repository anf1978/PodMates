// Notes and optional battle feedback templates; actions are supplied by the controller.
import { html, type TemplateResult } from "../../ui/html";
import type { Chronicle } from "./state";

export function notesTemplate(
  entry: Chronicle,
  limit: number,
  close: () => void,
  save: () => void,
): TemplateResult {
  return html`
    <button class="tad-close" id="tadCloseBtn" @click=${close}>Close ×</button>
    <h2 class="chronicles-dialog-heading">${entry.notes ? "Edit notes" : "Add notes"}</h2>
    <p class="tad-sub chronicles-dialog-sub">${entry.date || ""}</p>
    <textarea
      id="chronicleNotesInput"
      class="chronicles-notes-input"
      maxlength=${limit}
      placeholder="What happened? Anything worth remembering?"
      .value=${entry.notes || ""}
      @input=${(event: Event) => {
        const input = event.currentTarget as HTMLTextAreaElement;
        const counter = input.parentElement?.querySelector("#chronicleNotesCount");
        if (counter) counter.textContent = `${input.value.length} / ${limit}`;
      }}
    ></textarea>
    <div id="chronicleNotesCount" class="chronicles-count">
      ${`${(entry.notes || "").length} / ${limit}`}
    </div>
    <div id="chronicleNotesStatus" class="status chronicles-notes-status"></div>
    <div class="row chronicles-notes-buttons">
      <button id="chronicleNotesCancelBtn" class="ghost" @click=${close}>Cancel</button>
      <button id="chronicleNotesSaveBtn" @click=${save}>Save notes</button>
    </div>
  `;
}

export function ratingTemplate(current: number, pick: (rating: number) => void): TemplateResult {
  return html`${[1, 2, 3, 4, 5].map(
    (rating) => html`
      <button
        type="button"
        data-rate=${rating}
        class=${`ghost chronicles-rating${rating === current ? " chronicles-rating-selected" : ""}`}
        @click=${() => pick(rating)}
      >
        ${rating}
      </button>
    `,
  )}`;
}

export function feedbackTemplate(close: () => void, submit: () => void): TemplateResult {
  return html`
    <button class="tad-close" id="tadCloseBtn" @click=${close}>Close ×</button>
    <h2 class="chronicles-dialog-heading">How was the battle?</h2>
    <p class="chronicles-feedback-intro">Totally optional — skip if you'd rather not.</p>
    <div class="chronicles-feedback-rating">
      <label class="chronicles-feedback-label">Fun</label>
      <div id="funRatingRow" class="row chronicles-rating-row"></div>
    </div>
    <div class="chronicles-feedback-rating">
      <label class="chronicles-feedback-label">Alignment accuracy</label>
      <div id="accuracyRatingRow" class="row chronicles-rating-row"></div>
    </div>
    <div class="chronicles-feedback-moment">
      <label class="chronicles-feedback-label">Best moment</label>
      <textarea
        id="bestMomentInput"
        class="chronicles-moment-input"
        placeholder="Anything worth remembering?"
      ></textarea>
    </div>
    <div class="row chronicles-feedback-buttons">
      <button id="skipFeedbackBtn" class="ghost" @click=${close}>Skip</button>
      <button id="submitFeedbackBtn" @click=${submit}>Submit</button>
    </div>
    <div id="feedbackStatus" class="chronicles-feedback-status"></div>
  `;
}
