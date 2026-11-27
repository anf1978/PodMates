// "Battles to rate": the after-battle survey is answered later from Chronicles (or the bell's
// survey notice), never mid-game. Skips are remembered on this device only and write nothing.
import { html, nothing, type TemplateResult } from "../../ui/html";
import { battleLabel, type Chronicle } from "./state";

const KEY = "pm_survey_skipped_";
const MAX_SKIPS = 200;

export function loadSkipped(uid: string | null): Set<string> {
  if (!uid) return new Set();
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY + uid) || "[]");
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function skipSurvey(uid: string | null, chronicleId: string): void {
  if (!uid) return;
  const ids = [...loadSkipped(uid), chronicleId].slice(-MAX_SKIPS);
  try {
    localStorage.setItem(KEY + uid, JSON.stringify([...new Set(ids)]));
  } catch {
    // Storage blocked: the battle simply stays on the list.
  }
}

export interface SurveyListActions {
  rate: (entry: Chronicle) => void;
  skip: (entry: Chronicle) => void;
}

function rowsTemplate(items: Chronicle[], actions: SurveyListActions): TemplateResult {
  return html`<ul class="chronicles-surveys-list">
    ${items.map(
      (entry) =>
        html`<li class="chronicles-surveys-item">
          <span class="chronicles-surveys-what"
            ><strong>${battleLabel(entry)}</strong
            ><span class="chronicles-surveys-when"
              >${`${entry.gatheringTitle ? entry.gatheringTitle + " · " : ""}${entry.date || ""}`}</span
            ></span
          >
          <span class="row chronicles-surveys-buttons">
            <button
              type="button"
              class="ghost"
              data-survey-skip=${entry.id}
              @click=${() => actions.skip(entry)}
            >
              Skip
            </button>
            <button type="button" data-survey-rate=${entry.id} @click=${() => actions.rate(entry)}>
              Rate
            </button>
          </span>
        </li>`,
    )}
  </ul>`;
}

/** The box above the journal; nothing when there is nothing to rate. */
export function surveysPanelTemplate(
  items: Chronicle[],
  actions: SurveyListActions,
): TemplateResult | typeof nothing {
  if (!items.length) return nothing;
  return html`<div class="chronicles-surveys" id="chroniclesSurveys">
    <div class="chronicles-surveys-heading">${`Battles to rate (${items.length})`}</div>
    <p class="chronicles-surveys-intro">
      How was it? Rate the battles you played whenever suits you.
    </p>
    ${rowsTemplate(items, actions)}
  </div>`;
}

/** The dialog opened from the bell's survey notice. */
export function surveysDialogTemplate(
  heading: string,
  items: Chronicle[],
  close: () => void,
  actions: SurveyListActions,
): TemplateResult {
  return html`<button class="tad-close" id="tadCloseBtn" @click=${close}>Close ×</button>
    <h2 class="chronicles-surveys-heading">Battles to rate</h2>
    <p class="tad-sub chronicles-dialog-sub">${heading}</p>
    ${
      items.length
        ? rowsTemplate(items, actions)
        : html`<p class="chronicles-surveys-intro">All done: nothing left to rate. Thanks!</p>`
    }`;
}
