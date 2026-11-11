// Shared seat controls and RSVP writes for both gathering trays.
import { html, render, type TemplateResult } from "../../ui/html";
import { showToast } from "../../ui/toast";
import { notify } from "../../services/cloud/activity";
import { setSeatRsvp, type Gathering } from "../../services/cloud/gatherings";
import { requireUser } from "../../services/cloud/session";
import { reportError } from "../../services/report-error";
import type { GatheringSeat } from "../../services/cloud/types";
import {
  gatheringNewGuestSeat,
  gatheringWhenText,
  occupied,
  type GatheringDetails,
  type Member,
} from "./state";

export function addSelect(
  k: string,
  members: Member[],
  onAdd: (k: string, seat: GatheringSeat) => Promise<void>,
  label = "+ Add a player…",
): TemplateResult {
  const change = async (e: Event): Promise<void> => {
    const select = e.currentTarget as HTMLSelectElement;
    const value = select.value;
    if (!value) return;
    if (value === "__guest__") {
      const wrap = select.closest<HTMLElement>("[data-add-wrap]")!;
      const go = async (): Promise<void> => {
        const input = wrap.querySelector<HTMLInputElement>("[data-gname]")!;
        if (!input.value.trim()) {
          input.focus();
          return;
        }
        await onAdd(k, gatheringNewGuestSeat(input.value, k));
      };
      render(
        html`<div class="row g-gap6">
          <input
            type="text"
            data-gname
            maxlength="40"
            placeholder="Guest's name"
            class="g-input g-flex g-input-small"
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter") void go();
            }}
          />
          <button type="button" data-gadd class="g-f12" @click=${go}>Add guest</button>
          <button
            type="button"
            class="ghost g-f12"
            data-gcancel
            @click=${() => render(addSelect(k, members, onAdd), wrap)}
          >
            ×
          </button>
        </div>`,
        wrap,
      );
      wrap.querySelector<HTMLInputElement>("[data-gname]")!.focus();
      return;
    }
    const member = members.find((m) => m.uid === value);
    await onAdd(k, {
      uid: value,
      displayName: member?.displayLabel || member?.displayName || "Podmate",
      deck: null,
    });
  };
  return html`<div data-add-wrap class="g-mt6">
    <select data-add-seat=${k} class="g-input g-full g-input-small g-f125" @change=${change}>
      <option value="">${label}</option>
      ${members.map((m) => html`<option value=${m.uid}>${m.displayLabel || m.displayName || "Podmate"}</option>`)}
      <option value="__guest__">+ Add a guest (no account)…</option>
    </select>
  </div>`;
}

export async function gatheringRsvp(
  podId: string,
  g: Gathering,
  answer: "accepted" | "declined",
): Promise<void> {
  const mine = occupied(g).find((r) => r.s.uid === requireUser().uid);
  if (!mine) throw new Error("You are not seated at this gathering.");
  await setSeatRsvp(podId, g.id, mine.k, answer);
  await notify(
    "rsvp",
    (answer === "accepted" ? "accepted " : "can't make ") +
      '"' +
      (g.title || "the gathering") +
      '"',
    podId,
    g.id,
    [g.hostUid],
  );
}

export function inviteMessage(title: string, g: GatheringDetails, host: string): string {
  const when = gatheringWhenText(g);
  return `${host} has invited you to "${title}"${when ? " — " + when : ""}. Open PodMates and look for the invite on My Pods to accept or decline: ${location.origin}${location.pathname}`;
}

export function copyInvite(text: string): void {
  const done = (): void => showToast("Invite message copied.");
  const fallback = (): void => {
    const input = document.createElement("textarea");
    input.value = text;
    input.className = "g-clipboard";
    document.body.appendChild(input);
    try {
      input.select();
      if (!document.execCommand("copy")) throw new Error("Clipboard copy failed");
      done();
    } catch (error) {
      reportError(error, { operation: "gatherings" });
      showToast("Could not copy automatically.");
    } finally {
      input.remove();
    }
  };
  if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function inputValue(root: ParentNode, id: string): string {
  return root.querySelector<HTMLInputElement>(`#${id}`)!.value;
}
