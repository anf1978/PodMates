// Lit rendering for the Impact modal and chart caption; mounting is explicit.
import { html, nothing, render } from "../../ui/html";
import {
  IMPACT_PTS_CAP,
  IMPACT_PTS_PER_CARD,
  impactCardsInDeck,
} from "../../engine/axes/power-level";
import { DEFAULT_IMPACT_CARDS } from "../../data/impact-defaults";
import { listView } from "./list-view";
import { ideasView } from "./ideas-view";
import {
  canEdit,
  cleanChanges,
  computePodView,
  currentPod,
  type Candidate,
  type ChartAnalysis,
  type ImpactState,
} from "./state";

export function modalView() {
  return html`<button class="tad-close" id="tadCloseBtn">Close ×</button>
    <h2 class="impact-title">Impact cards</h2>
    <p class="tad-sub impact-subtitle">The cards that move Power beyond Game Changers</p>
    <div id="impactBody">Loading…</div>`;
}
export function captionView(agg: Pick<ChartAnalysis["agg"], "deckCardNames">, open: () => void) {
  return html`<div class="chart-caption">
      <button type="button" class="ghost impact-caption-button" id="impactCardsBtn" @click=${open}>
        Impact cards…
      </button>
      <span class="impact-caption-count"
        >${`${impactCardsInDeck(agg).length} of ${DEFAULT_IMPACT_CARDS.length} default impact cards in this deck`}</span
      >
    </div>
    <div id="podViewLine"></div>`;
}
export function renderBody(
  body: HTMLElement,
  state: ImpactState,
  rows: readonly Candidate[],
  uid: string | null,
  chart: ChartAnalysis | null,
): void {
  state.confirmReset = false;
  const editable = canEdit(state, uid),
    changes = cleanChanges(state.changes);
  const v = computePodView(chart, changes);
  render(
    html`
      <div class="impact-description">
        ${`Impact cards are cards that show up constantly in competitive (cEDH) lists but almost never in precons or ordinary tuned decks. Each one in a deck adds ${IMPACT_PTS_PER_CARD} to Power (up to ${IMPACT_PTS_CAP}). The default list is chosen from the reference decks and is what the radar always uses.`}
      </div>
      ${
        !uid
          ? html`<div class="impact-account-note">
              Sign in and join a pod to see or propose your pod's own version of this list.
            </div>`
          : !state.pods?.length
            ? html`<div class="impact-account-note">
                Join or create a pod to propose your own version of this list.
              </div>`
            : html` <div class="impact-pod">
                  <label for="impactPodSel">Pod</label
                  ><select id="impactPodSel" .value=${state.podId || ""} ?disabled=${state.busy}>
                    ${state.pods.map((p) => html`<option value=${p.id} ?selected=${p.id === state.podId}>${p.name || "Pod"}</option>`)}
                  </select>
                  <span
                    >${editable ? "You can edit this list." : "Only the Steward and Co-Stewards can edit; you can read the list and reasons."}</span
                  >
                </div>
                ${v && chart && Object.keys(changes).length ? html`<div class="impact-pod-summary">${`Pod view for the deck on screen: Power ${v.power.toFixed(1)} (standard ${chart.scores.powerLevel.toFixed(1)}), Spark ${v.spark.toFixed(1)} (standard ${chart.spark.toFixed(1)}).`}</div>` : nothing}
                ${state.updatedAt ? html`<div class="impact-note impact-updated">${`List last changed ${new Date(state.updatedAt).toLocaleDateString()}.`}</div>` : nothing}`
      }
      ${listView(state, !!uid, editable, chart)} ${ideasView(state, rows, uid, editable)}
      ${
        editable && !state.busy
          ? html`<div class="impact-search">
              <div id="impactSearchHits" class="pm-sr"></div>
              <input
                id="impactSearch"
                type="text"
                placeholder="Search for a card to add…"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
                class="impact-search-input"
              />
              <div class="impact-note impact-updated">
                Up to 15 added cards and 60 changes in total. Every change is saved with your name
                and can be undone by ticking the card back.
              </div>
              ${Object.keys(changes).length ? html`<div class="impact-more"><button type="button" class="ghost impact-reset" id="impactResetBtn">Reset to the default list</button></div>` : nothing}
            </div>`
          : nothing
      }
    `,
    body,
  );
}
export function renderPodView(
  el: HTMLElement,
  state: ImpactState,
  chart: ChartAnalysis | null,
): void {
  const changes = cleanChanges(state.changes),
    count = Object.keys(changes).length;
  const pod = currentPod(state),
    v = computePodView(chart, changes);
  render(
    count && pod && v && chart
      ? html`<div class="chart-caption impact-chart-pod">
          <strong>${`Pod view \u00b7 ${pod.name || "your pod"}`}</strong
          >${`: Power ${v.power.toFixed(1)} (standard ${chart.scores.powerLevel.toFixed(1)}) \u00b7 Spark ${v.spark.toFixed(1)} (standard ${chart.spark.toFixed(1)}). Uses your pod's edited impact-card list (${count} change${count === 1 ? "" : "s"} from the default). The radar and every band above always use the standard list.`}
        </div>`
      : nothing,
    el,
  );
}
