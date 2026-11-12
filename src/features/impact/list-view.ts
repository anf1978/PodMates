// Default/proposed list and reason editor. Card names and reasons remain escaped template data.
import { html, nothing } from "../../ui/html";
import { cardNameLink } from "../../ui/card-name";
import { DEFAULT_IMPACT_CARDS } from "../../data/impact-defaults";
import { impactCardsInDeck } from "../../engine/axes/power-level";
import {
  cleanChanges,
  effectiveList,
  impactKey,
  type ChartAnalysis,
  type ImpactState,
} from "./state";
import type { ImpactChange } from "../../services/cloud/types";

function reasonText(c: ImpactChange | undefined) {
  if (!c?.reason) return nothing;
  const who = c.reasonBy || c.byName;
  return html`<div class="impact-reason">
    ${`\u201c${c.reason}\u201d${who ? ` \u2014 ${who}` : ""}`}
  </div>`;
}
export function listView(
  state: ImpactState,
  signedIn: boolean,
  canEdit: boolean,
  chart: ChartAnalysis | null,
) {
  const changes = cleanChanges(state.changes);
  const effective = new Set(effectiveList(changes).map((n) => n.toLowerCase()));
  const rows = [
    ...DEFAULT_IMPACT_CARDS,
    ...Object.values(changes)
      .filter((c) => c.action === "add")
      .map((c) => c.card),
  ];
  return html`<div class="impact-list">
    ${rows.map((name) => {
      const key = impactKey(name),
        c = changes[key],
        checked = effective.has(name.toLowerCase());
      const open = state.openReasonKey === key;
      return html`<div class="impact-card">
        <div class="impact-card-main">
          <input
            type="checkbox"
            data-impact-toggle=${key}
            data-card=${name}
            .checked=${checked}
            ?disabled=${!signedIn || !canEdit || state.busy}
            aria-label=${`Include ${name}`}
          />
          <span class=${`impact-card-name${checked ? "" : " impact-removed"}`}
            >${cardNameLink(name)}</span
          >
          ${chart && impactCardsInDeck(chart.agg, [name]).length ? html`<span class="impact-in-deck">in this deck</span>` : nothing}
          ${c ? html`<span class="impact-changed">${c.action === "add" ? "added by pod" : "removed by pod"}</span>` : nothing}
          ${
            c && signedIn
              ? html`<button
                  type="button"
                  class="ghost impact-reason-button"
                  data-impact-reason=${key}
                  title=${canEdit ? "Add or edit the reason" : "Read the reason"}
                  aria-label=${`Reason for ${name}`}
                >
                  💬
                </button>`
              : nothing
          }
        </div>
        ${open ? nothing : reasonText(c)}
        ${
          open && c
            ? canEdit
              ? html`<div class="impact-editor">
                  <div class="impact-editor-label">
                    ${`Why ${c.action === "add" ? "include" : "remove"} ${name}? (optional)`}
                  </div>
                  <textarea
                    id="impactReasonInput"
                    maxlength="280"
                    rows="2"
                    class="impact-reason-input"
                    .value=${c.reason || ""}
                  ></textarea>
                  <div class="impact-editor-buttons">
                    <button type="button" data-impact-reason-save=${key}>Save</button
                    ><button type="button" class="ghost" data-impact-reason-cancel="1">Skip</button>
                  </div>
                </div>`
              : html`<div class="impact-reader">${c.reason || "No reason was given."}</div>`
            : nothing
        }
      </div>`;
    })}
  </div>`;
}
