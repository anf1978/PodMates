// Candidate queue and member nominations; every action retains its legacy data attribute.
import { html, nothing, type TemplateResult } from "../../ui/html";
import { cardNameLink } from "../../ui/card-name";
import {
  candidates,
  currentPod,
  effectiveList,
  impactKey,
  type Candidate,
  type ImpactState,
} from "./state";

function button(action: string, card: string, label: string, primary = false) {
  return html`<button
    type="button"
    class=${primary ? "impact-idea-button" : "ghost impact-idea-button"}
    data-impact-add=${action === "add" ? card : nothing}
    data-impact-dismiss=${action === "dismiss" ? card : nothing}
    data-impact-nominate=${action === "nominate" ? card : nothing}
    data-impact-nom-accept=${action === "accept" ? card : nothing}
    data-impact-nom-reject=${action === "reject" ? card : nothing}
    data-impact-nom-withdraw=${action === "withdraw" ? card : nothing}
  >
    ${label}
  </button>`;
}
function row(name: string, sub: string, why: string, buttons: TemplateResult | typeof nothing) {
  return html`<div class="impact-idea-row">
    <div class="impact-idea-main">
      <span class="impact-idea-name">${cardNameLink(name)}</span>${buttons}
    </div>
    <div class="impact-idea-sub">${sub}</div>
    ${why ? html`<div class="impact-idea-why">${`\u201c${why}\u201d`}</div>` : nothing}
  </div>`;
}
export function ideasView(
  state: ImpactState,
  rows: readonly Candidate[],
  uid: string | null,
  canEdit: boolean,
) {
  const effective = new Set(effectiveList(state.changes).map((n) => n.toLowerCase()));
  const noms = state.nominations.filter(
    (n) =>
      n &&
      typeof n.card === "string" &&
      !effective.has(n.card.toLowerCase()) &&
      !state.dismissed[impactKey(n.card)],
  );
  const all = candidates(rows, state),
    shown = all.slice(0, state.candMore ? 24 : 6);
  const inPod = !!uid && !!currentPod(state),
    canNominate = inPod && !canEdit && state.nomOk;
  const dismissed = Object.keys(state.dismissed).length;
  return html`<div class="impact-ideas">
    <div class="impact-ideas-title">Nominations and ideas</div>
    <div class="impact-idea-sub">
      ${`${canEdit ? "Accept a card to add it to your pod\u2019s list, or turn it down to hide it." : "Any pod member can nominate a card. The Steward and Co-Stewards decide."} This only changes your pod\u2019s own view; the radar always uses the default list.`}
    </div>
    ${inPod && !state.nomOk ? html`<div class="impact-note impact-nom-unavailable">Nominations are not switched on for this pod yet (the Steward needs to publish the latest Firestore rules).</div>` : nothing}
    ${
      noms.length
        ? html`<div class="impact-queue-heading">Nominated by your pod</div>
            ${noms.map((n) =>
              row(
                n.card,
                `nominated by ${n.byName || "a pod member"}`,
                n.note,
                !state.busy && canEdit
                  ? html`${button("accept", n.card, "Accept", true)}${button("reject", n.card, "Not for us")}`
                  : !state.busy && uid === n.by
                    ? button("withdraw", n.card, "Withdraw")
                    : nothing,
              ),
            )}`
        : nothing
    }
    ${
      shown.length
        ? html`<div class="impact-queue-heading">From the card lists</div>
            ${shown.map((c) =>
              row(
                c[0],
                `${c[1]} list, #${c[2]} of ${c[3]}${c[4] > 1 ? ` (on ${c[4]} power lists)` : ""} \u00b7 in ${c[5]} of 159 precons`,
                c[6],
                !state.busy && canEdit
                  ? html`${button("add", c[0], "Add", true)}${button("dismiss", c[0], "Not for us")}`
                  : !state.busy && canNominate
                    ? button("nominate", c[0], "Nominate")
                    : nothing,
              ),
            )}
            ${all.length > shown.length ? html`<div class="impact-more"><button type="button" class="ghost impact-small-button" data-impact-more="1">${`Show more ideas (${Math.min(all.length, 24) - shown.length})`}</button></div>` : nothing}
            <div class="impact-note impact-ideas-explanation">
              Chosen because they rank high on the power-focused best-of lists (tutors, cost
              reducers, extra turns, stax, doublers and so on) but show up in almost no precons.
              Strong, scarce cards: the pod decides whether they count as impact.
            </div>`
        : !noms.length
          ? html`<div class="impact-empty">No ideas left to review.</div>`
          : nothing
    }
    ${
      canNominate && !state.busy
        ? html`<div class="impact-nominate">
            <div class="impact-nominate-title">Nominate any card</div>
            <div id="impactNomHits" class="pm-sr"></div>
            <input
              id="impactNomSearch"
              type="text"
              placeholder="Search for a card to nominate…"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              class="impact-nom-search"
            />
            <input
              id="impactNomNote"
              type="text"
              maxlength="200"
              placeholder="Why? (optional, applies to the next nomination)"
              autocomplete="off"
              class="impact-nom-note"
            />
          </div>`
        : nothing
    }
    ${canEdit && dismissed && !state.busy ? html`<div class="impact-restore"><button type="button" class="ghost impact-small-button" data-impact-restore="1">${`Bring back ${dismissed} turned-down card${dismissed === 1 ? "" : "s"}`}</button></div>` : nothing}
  </div>`;
}
