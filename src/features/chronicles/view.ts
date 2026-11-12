// Escaped templates for the pod's grouped journal and its existing panel structure.
import { html, nothing, type TemplateResult } from "../../ui/html";
import {
  canEditChronicle,
  chronicleDeck,
  feedbackSummary,
  groupChronicles,
  type ChroniclesState,
} from "./state";

export function panelTemplate(clear: () => void): TemplateResult {
  return html`
    <details class="panel-collapsible">
      <summary class="panel-toggle">Chronicles &amp; Stories</summary>
      <div id="matchHistoryBody">
        <p class="chronicles-intro">
          Your active pod's shared nights, grouped by Gathering, visible to every member. Capture
          lessons and fun — not just who won.
        </p>
        <div id="matchLogArea" class="chronicles-log"></div>
        <div class="row chronicles-clear">
          <button id="clearMatchHistoryBtn" class="ghost" @click=${clear}>Clear Chronicles</button>
        </div>
      </div>
    </details>
  `;
}

export function historyTemplate(
  state: ChroniclesState,
  edit: (id: string) => void,
  remove: (id: string) => void,
): TemplateResult {
  if (!state.entries.length)
    return html`<em
      >No chapters yet -- host a Gathering, chart a battle, and Log Battle to start your
      Chronicles.</em
    >`;
  return html`${[...groupChronicles(state.entries)].map(
    ([title, entries]) => html`
      <div class="chronicles-group">
        <div class="chronicles-heading">${title}</div>
        ${entries.map((entry) => {
          const responses = entry.feedbackResponses || [];
          const { fun, accuracy, moments } = feedbackSummary(responses);
          const ratings = `${fun ? `Fun: ${fun}/5` : ""}${fun && accuracy ? " · " : ""}${accuracy ? `Alignment: ${accuracy}/5` : ""} (${responses.length} response${responses.length === 1 ? "" : "s"})`;
          return html`
            <div class="chronicles-entry">
              <div class="chronicles-date">${entry.date || ""}</div>
              <div>
                ${(entry.decks || []).map((value, index) => {
                  const deck = chronicleDeck(value);
                  return html`${index ? " · " : ""}<strong>${deck.commander || deck.name || "?"}</strong>${`${deck.player ? ` (${deck.player})` : ""} · Spark ${String(deck.spark)}`}`;
                })}
              </div>
              ${fun || accuracy ? html`<div class="chronicles-ratings">${ratings}</div>` : nothing}
              ${
                moments.length
                  ? html`<div class="chronicles-moments">${moments.join(" · ")}</div>`
                  : nothing
              }
              ${entry.notes ? html`<div class="chronicles-notes">${entry.notes}</div>` : nothing}
              ${
                canEditChronicle(entry, state)
                  ? html`<div class="chronicles-actions">
                      <button
                        type="button"
                        data-chron-edit=${entry.id}
                        class="chronicles-edit"
                        @click=${() => edit(entry.id)}
                      >
                        ${entry.notes ? "Edit notes" : "Add notes"}
                      </button>
                      <button
                        type="button"
                        data-chron-del=${entry.id}
                        class="chronicles-delete"
                        @click=${() => remove(entry.id)}
                      >
                        Delete
                      </button>
                    </div>`
                  : nothing
              }
            </div>
          `;
        })}
      </div>
    `,
  )}`;
}
