// Seat rendering and actions shared by the waiting and live trays.
import { html, nothing, type TemplateResult } from "../../ui/html";
import { showToast } from "../../ui/toast";
import { loadPodMembers } from "../../services/cloud/members";
import { setGatheringSeat, type Gathering } from "../../services/cloud/gatherings";
import { notify } from "../../services/cloud/activity";
import { reportError } from "../../services/report-error";
import { addSelect, errorMessage } from "./controls";
import { GATHERING_KEYS, occupied, gatheringRsvpOf, type Member } from "./state";
import { gatheringRuntime } from "./runtime";

export interface TrayActions {
  open(): Promise<void>;
  refresh(): Promise<void>;
  stop(): void;
  pick(k: string, g: Gathering): void;
}

export async function availableMembers(
  podId: string,
  g: Gathering,
  isHost: boolean,
): Promise<Member[]> {
  if (!isHost) return [];
  try {
    const members = await loadPodMembers(podId);
    const seated = new Set(occupied(g).map((r) => r.s.uid));
    return members.filter((m) => !seated.has(m.uid));
  } catch (error) {
    reportError(error, { operation: "gatherings" });
    return [];
  }
}

export function seatViews(
  podId: string,
  g: Gathering,
  members: Member[],
  isHost: boolean,
  actions: TrayActions,
  waiting = false,
): TemplateResult {
  const add = (k: string, label?: string): TemplateResult =>
    addSelect(
      k,
      members,
      async (k, seat) => {
        try {
          await setGatheringSeat(podId, g.id, k, {
            ...seat,
            rsvp: waiting && !seat.guest ? "invited" : "accepted",
          });
          if (waiting && !seat.guest && seat.uid)
            await notify("invite", g.title || "Gathering", podId, g.id, [seat.uid]);
          await actions.refresh();
        } catch (error) {
          showToast("Could not seat that player: " + errorMessage(error));
        }
      },
      label,
    );
  return html`${GATHERING_KEYS.map((k) => {
    const s = g.seats?.[k],
      n = Number(k) + 1;
    if (!s?.uid)
      return html`<div class="g-empty-seat">
        ${`Seat ${n} — empty`}${isHost ? add(k) : nothing}
      </div>`;
    const declined = waiting && gatheringRsvpOf(s) === "declined";
    const badge =
      s.uid === g.hostUid
        ? html`<span class="g-gold">Host</span>`
        : s.guest
          ? html`<span class="g-soft">Guest</span>`
          : gatheringRsvpOf(s) === "accepted"
            ? html`<span class="g-leaf">✓ Accepted</span>`
            : declined
              ? html`<span class="g-danger">✗ Can't make it</span>`
              : html`<span class="g-gold">… Waiting for a reply</span>`;
    const remove = (): void => {
      const name = s.displayName || "this player";
      gatheringRuntime().confirm(
        waiting
          ? `Remove ${name} from the gathering? Their seat will be cleared.`
          : `Remove ${name} from the Gathering? Their seat will be cleared, including any deck they'd already picked.`,
        "Remove",
        async () => {
          try {
            await setGatheringSeat(podId, g.id, k, { uid: null, displayName: null, deck: null });
          } catch (error) {
            showToast("Could not remove that player: " + errorMessage(error));
          }
          await actions.open();
        },
        () => {
          void actions.open();
        },
      );
    };
    const deckLabel = declined
      ? "Seat is free to fill"
      : s.deck
        ? String(s.deck.commander || "Deck loaded")
        : waiting
          ? "No deck chosen yet"
          : "No deck selected yet";
    return html`<div class=${declined ? "g-seat g-seat-declined" : "g-seat"}>
      ${
        waiting
          ? html`<div class="g-seat-heading">
              <span class="g-weight600">${`Seat ${n} — ${s.displayName || "Podmate"}`}</span
              ><span class="g-badge">${badge}</span>
            </div>`
          : html`<div class="g-weight600 g-mb4">
              ${`Seat ${n} — ${s.displayName || "Podmate"}${s.uid === g.hostUid ? " (Host)" : ""}${s.guest ? " (Guest)" : ""}`}
            </div>`
      }
      <div class="g-deck-label">${deckLabel}</div>
      <div class="row g-gap6">
        ${
          declined
            ? nothing
            : html`<button
                type="button"
                class="ghost g-f12 g-flex"
                data-gathering-seat=${k}
                @click=${() => actions.pick(k, g)}
              >
                Load a Deck
              </button>`
        }
        ${
          isHost && s.uid !== g.hostUid
            ? html`<button
                type="button"
                class="ghost g-f12 g-danger-button"
                data-remove-seat=${k}
                @click=${remove}
              >
                ${declined ? "Clear seat" : "Remove"}
              </button>`
            : nothing
        }
      </div>
      ${isHost && declined ? add(k, "+ Replace with…") : nothing}
    </div>`;
  })}`;
}
