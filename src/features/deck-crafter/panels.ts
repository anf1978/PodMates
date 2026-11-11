// Independently refreshed commander and card-list templates.
import { html, nothing } from "../../ui/html";
import type { CrafterState } from "./state";
import { commanderNames, fitsIdentity, identityCard, pairing } from "./state";
import type { CardRecord } from "../../cards/tuple";
import { PM_LIMITS } from "../../services/cloud/limits";

export function commanderTemplate(
  state: CrafterState,
  find: (name: string) => CardRecord | undefined,
  remove: (index: number) => void,
  togglePartner: () => void,
) {
  const names = commanderNames(state.commander);
  if (!names.length) return html`<span class="db-no-commander">No commander set yet</span>`;
  const { canPair, pairOk } = pairing(names.map(find));
  return html`${names.map(
    (name, i) =>
      html`<div class="db-commander">
        <span class="db-commander-name">${name}</span>
        <button type="button" class="ghost db-change" data-dbcmd-rm=${i} @click=${() => remove(i)}>
          ${names.length > 1 ? "Remove" : "Change"}
        </button>
      </div>`,
  )}
  ${canPair ? html`<button type="button" class="ghost db-partner" id="dbAddPartnerBtn" @click=${togglePartner}>${state.addingPartner ? "Cancel second commander" : "+ Add a partner or Background"}</button>` : nothing}
  ${names.length === 2 && !pairOk ? html`<div class="db-pair-warning">That pair isn’t a legal commander pairing (both need Partner, both need Friends forever, a Background goes with Choose a Background, or a Doctor with Doctor’s companion).</div>` : nothing}`;
}

export function listTemplate(
  state: CrafterState,
  find: (name: string) => CardRecord | undefined,
  quantity: (name: string, value: string) => void,
  remove: (name: string) => void,
) {
  const names = Object.keys(state.cards).sort();
  if (!names.length) return html`<p class="db-empty">No cards added yet.</p>`;
  const identity = state.commander ? identityCard(state, find) : null;
  return html`${names.map((name) => {
    const card = find(name);
    const fits = !card || fitsIdentity(card, identity);
    return html`<div class="db-card-row">
      ${!fits ? html`<span title=${`Outside ${state.commander}'s color identity`} class="db-color-warning">⚠</span>` : nothing}
      <span class="db-card-name">${name}</span>
      <input
        type="number"
        min="0"
        .value=${String(Number(state.cards[name]) || 0)}
        max=${PM_LIMITS.builderMaxQty}
        data-qty-for=${name}
        class="db-quantity"
        @change=${(event: Event) => quantity(name, (event.currentTarget as HTMLInputElement).value)}
      />
      <button
        type="button"
        class="ghost db-remove"
        data-remove=${name}
        @click=${() => remove(name)}
      >
        ×
      </button>
    </div>`;
  })}`;
}
