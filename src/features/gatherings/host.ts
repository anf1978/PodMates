// Host setup and saved lineups; all persistence goes through cloud repositories.
import { html, render, nothing } from "../../ui/html";
import { openTadOverlay, closeTryADeckModal } from "../../ui/tad-modal";
import { showToast } from "../../ui/toast";
import { requireUser } from "../../services/cloud/session";
import { createGathering } from "../../services/cloud/gatherings";
import { loadAllTableFormations, saveTableFormation } from "../../services/cloud/table-formations";
import { notify } from "../../services/cloud/activity";
import { PM_LIMITS } from "../../services/cloud/limits";
import { reportError } from "../../services/report-error";
import {
  collectSeats,
  restoreLineup,
  gatheringWhenText,
  type Assignment,
  type Member,
  type CollectedSeats,
  type GatheringDetails,
} from "./state";
import { copyInvite, inviteMessage, errorMessage, inputValue } from "./controls";
import { gatheringRuntime } from "./runtime";

type OpenGathering = (podId: string, gatheringId: string) => Promise<void>;
type Pod = { id: string };

export async function openHostGatheringOverlay(
  pod: Pod,
  members: Member[],
  open: OpenGathering,
): Promise<void> {
  closeTryADeckModal();
  const user = requireUser();
  const myName = members.find((m) => m.uid === user.uid)?.displayName || user.displayName || "Host";
  let assignments: Assignment[] = [user.uid, null, null, null, null, null];
  let lineups: Awaited<ReturnType<typeof loadAllTableFormations>> = {};
  try {
    lineups = await loadAllTableFormations(pod.id);
  } catch (error) {
    reportError(error, { operation: "gatherings" });
  }
  const { modal } = openTadOverlay();
  const names = Object.keys(lineups).sort();
  const status = (message: string): void => {
    const el = modal.querySelector<HTMLElement>("#hostGatheringStatus")!;
    el.textContent = message;
    el.className = message ? "status err" : "g-host-status";
  };
  const seats = (): void => {
    const area = modal.querySelector<HTMLElement>("#hostSeatsArea")!;
    render(
      html`${assignments.map((a, i) => {
        if (i === 0)
          return html`<div class="g-host-seat">Seat 1 — <strong>${myName}</strong> (you)</div>`;
        if (a && typeof a === "object")
          return html`<div class="row g-host-guest">
            <span class="g-seat-label">${`Seat ${i + 1} · Guest`}</span>
            <input
              type="text"
              data-guest-name=${i}
              maxlength="40"
              .value=${a.guest}
              placeholder="Guest's name"
              class="g-input g-flex g-min0"
              @input=${(e: Event) => {
                a.guest = (e.currentTarget as HTMLInputElement).value;
              }}
            />
            <button
              type="button"
              class="ghost g-f12"
              data-guest-clear=${i}
              aria-label="Clear this seat"
              @click=${() => {
                assignments[i] = null;
                seats();
              }}
            >
              ×
            </button>
          </div>`;
        const taken = assignments.filter((u, j) => j !== i && typeof u === "string");
        const options = members.filter((m) => m.uid !== user.uid && !taken.includes(m.uid));
        return html`<div class="g-mb6">
          <select
            data-seat-index=${i}
            class="g-input g-full"
            @change=${(e: Event) => {
              const value = (e.currentTarget as HTMLSelectElement).value;
              assignments[i] = value === "__guest__" ? { guest: "" } : value || null;
              seats();
              if (value === "__guest__")
                area.querySelector<HTMLInputElement>(`[data-guest-name="${i}"]`)?.focus();
            }}
          >
            <option value="" ?selected=${!a}>${`Seat ${i + 1} — empty`}</option>
            ${options.map((m) => html`<option value=${m.uid} ?selected=${m.uid === a}>${`Seat ${i + 1} — ${m.displayLabel || m.displayName || "Podmate"}`}</option>`)}
            <option value="__guest__">${`Seat ${i + 1} — + Add a guest (no account)…`}</option>
          </select>
        </div>`;
      })}`,
      area,
    );
  };
  const fields = (): GatheringDetails & { title: string } => ({
    title: inputValue(modal, "gatheringTitleInput").trim(),
    whenDate: inputValue(modal, "gatheringDateInput"),
    whenTime: inputValue(modal, "gatheringTimeInput"),
    place: inputValue(modal, "gatheringPlaceInput").trim(),
  });
  const busy = (value: boolean): void => {
    for (const id of ["sendInvitesBtn", "goLiveBtn"])
      modal.querySelector<HTMLButtonElement>(`#${id}`)!.disabled = value;
  };
  const start = async (mode: "invite" | "now"): Promise<void> => {
    status("");
    const c = collectSeats(assignments, members, mode);
    if ("error" in c) {
      status(c.error);
      return;
    }
    if (mode === "invite" && !c.invitees.length) {
      status("Add at least one podmate to invite, or use Start now.");
      return;
    }
    if (mode === "now" && c.count < 2) {
      status("Seat at least one other player (or a guest) first.");
      return;
    }
    const f = fields();
    const title = mode === "invite" ? f.title || `${myName}'s gathering` : f.title;
    const button = modal.querySelector<HTMLButtonElement>(
      mode === "invite" ? "#sendInvitesBtn" : "#goLiveBtn",
    )!;
    busy(true);
    button.textContent = mode === "invite" ? "Sending invites…" : "Starting…";
    try {
      const id = await createGathering(pod.id, title, {
        ...f,
        seats: c.seats,
        status: mode === "invite" ? "proposed" : "live",
      });
      if (mode === "invite") {
        const sent = await notify("invite", title, pod.id, id, c.invitees);
        if (modal.isConnected) invitesSent(modal, pod.id, id, title, f, c, sent, myName, open);
      } else {
        closeTryADeckModal();
        await open(pod.id, id);
      }
    } catch (error) {
      reportError(error, { operation: "gatherings" });
      status(
        (mode === "invite" ? "Could not send the invites: " : "Could not start the Gathering: ") +
          errorMessage(error),
      );
      busy(false);
      button.textContent =
        mode === "invite"
          ? "Send invites & wait for replies"
          : "Start now (everyone is already here)";
    }
  };
  const save = async (): Promise<void> => {
    const input = modal.querySelector<HTMLInputElement>("#saveLineupNameInput")!;
    const name = input.value.trim();
    if (!name) {
      status("Enter a name for this lineup first.");
      return;
    }
    const saved = assignments.map((a) => {
      if (!a) return null;
      if (typeof a === "object")
        return a.guest.trim()
          ? { uid: "", guest: true, displayName: a.guest.trim().slice(0, 40) }
          : null;
      const member = members.find((m) => m.uid === a);
      return {
        uid: a,
        displayName:
          a === user.uid ? myName : member?.displayLabel || member?.displayName || "Podmate",
      };
    });
    try {
      await saveTableFormation(pod.id, name, { seats: saved, savedAt: Date.now() });
      showToast(`Saved lineup "${name}".`);
      input.value = "";
    } catch (error) {
      reportError(error, { operation: "gatherings" });
      status("Could not save that lineup: " + errorMessage(error));
    }
  };
  render(
    html` <button class="tad-close" id="tadCloseBtn" @click=${closeTryADeckModal}>Close ×</button>
      <h2 class="g-mb10">Host a Gathering</h2>
      ${
        names.length
          ? html`<div class="row g-gap8 g-mb14">
              <select id="loadLineupSelect" class="g-input g-flex">
                <option value="">— Load a saved lineup —</option>
                ${names.map((n) => html`<option value=${n}>${n}</option>`)}
              </select>
              <button
                id="loadLineupBtn"
                class="ghost g-nowrap"
                @click=${() => {
                  const name = inputValue(modal, "loadLineupSelect");
                  if (!name || !lineups[name]) return;
                  assignments = restoreLineup(lineups[name].seats, members, user.uid);
                  seats();
                  showToast(`Loaded "${name}".`);
                }}
              >
                Load
              </button>
            </div>`
          : nothing
      }
      <div class="g-mb14">
        <label class="g-label">Name the Gathering</label>
        <input
          id="gatheringTitleInput"
          type="text"
          maxlength=${PM_LIMITS.gatheringTitle}
          placeholder="e.g. Friday Night Bash"
          class="g-input g-full"
        />
      </div>
      <div class="g-mb16">
        <label class="g-label">When and where <span class="g-label-note">(optional)</span></label>
        <div class="row g-gap8 g-mb8">
          <input id="gatheringDateInput" type="date" class="g-input g-flex g-min0" />
          <input id="gatheringTimeInput" type="time" class="g-input g-flex g-min0" />
        </div>
        <input
          id="gatheringPlaceInput"
          type="text"
          maxlength="120"
          placeholder="Where? (e.g. Archer's place)"
          class="g-input g-full"
        />
      </div>
      <label class="g-label">Seats</label>
      <div id="hostSeatsArea" class="g-mb12"></div>
      <div class="row g-mb16 g-gap8">
        <input
          id="saveLineupNameInput"
          type="text"
          maxlength=${PM_LIMITS.formationName}
          placeholder="Save this lineup as…"
          class="g-input g-flex g-input-small"
        />
        <button id="saveLineupBtn" class="ghost g-nowrap g-f12" @click=${save}>Save Lineup</button>
      </div>
      <button id="sendInvitesBtn" class="g-full" @click=${() => start("invite")}>
        Send invites &amp; wait for replies
      </button>
      <button id="goLiveBtn" class="ghost g-full g-mt8" @click=${() => start("now")}>
        Start now (everyone is already here)
      </button>
      <p class="g-host-note">
        Invites show up in each podmate's bell and on their My Pods page. Guests are not sent
        anything: you load their deck yourself.
      </p>
      <div id="hostGatheringStatus" class="g-host-status"></div>`,
    modal,
  );
  seats();
}

function invitesSent(
  modal: HTMLElement,
  podId: string,
  id: string,
  title: string,
  details: GatheringDetails,
  seats: CollectedSeats,
  sent: boolean,
  host: string,
  open: OpenGathering,
): void {
  const done = (): void => {
    closeTryADeckModal();
    gatheringRuntime().refreshPods();
  };
  const when = gatheringWhenText(details);
  render(
    html` <button class="tad-close" id="tadCloseBtn" @click=${done}>Close ×</button>
      <h2 class="g-mb4">${sent ? "Invites sent" : "Gathering created"}</h2>
      <p class="g-invite-title"><strong>${title}</strong>${when ? " · " + when : ""}</p>
      <p class="g-invite-summary">
        ${
          sent
            ? "It is now waiting for replies. You will get a bell alert as each person accepts or declines."
            : "The gathering was created, but PodMates could not confirm the invites were delivered. Open the waiting room and use Resend invites."
        }
      </p>
      <div class="g-mb12">
        ${seats.inviteeNames.map((n) => html`<div class="g-invite-row">${n} <span class=${sent ? "g-f12 g-leaf" : "g-f12 g-danger"}>${sent ? "— invited in PodMates" : "— invite not confirmed"}</span></div>`)}
        ${seats.guestNames.map((n) => html`<div class="g-invite-row">${n} <span class="g-f12 g-soft">— guest, no invite needed</span></div>`)}
      </div>
      <p class="g-invite-note">
        Invites appear in each podmate's bell and as a card on their My Pods page. Email and phone
        alerts are not built yet, so it is worth messaging them as well:
      </p>
      <button
        type="button"
        id="invCopyBtn"
        class="ghost g-full g-mb8"
        @click=${() => copyInvite(inviteMessage(title, details, host))}
      >
        Copy an invite message
      </button>
      <button type="button" id="invOpenBtn" class="g-full g-mb8" @click=${() => open(podId, id)}>
        Open the waiting room
      </button>
      <button type="button" id="invDoneBtn" class="ghost g-full" @click=${done}>Done</button>`,
    modal,
  );
}
