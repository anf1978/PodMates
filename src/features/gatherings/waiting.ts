// Proposed gatherings: replies, host edits, reminders and transition to live.
import { html, render, nothing } from "../../ui/html";
import { closeTryADeckModal } from "../../ui/tad-modal";
import { showToast } from "../../ui/toast";
import { requireUser } from "../../services/cloud/session";
import {
  cancelGathering,
  goLiveGathering,
  setGatheringSeat,
  updateGatheringDetails,
  type Gathering,
} from "../../services/cloud/gatherings";
import { notify } from "../../services/cloud/activity";
import { gatheringRuntime } from "./runtime";
import { gatheringRsvpOf, gatheringWhenText, occupied } from "./state";
import { copyInvite, inviteMessage, gatheringRsvp, errorMessage, inputValue } from "./controls";
import { availableMembers, seatViews, type TrayActions } from "./tray";

export async function renderWaitingTray(
  content: HTMLElement,
  podId: string,
  g: Gathering,
  actions: TrayActions,
  current: () => boolean,
): Promise<void> {
  const uid = requireUser().uid,
    isHost = g.hostUid === uid;
  const seated = occupied(g);
  const inPlay = seated.filter((r) => gatheringRsvpOf(r.s) !== "declined");
  const pending = inPlay.filter((r) => gatheringRsvpOf(r.s) === "invited");
  const mine = seated.find((r) => r.s.uid === uid);
  const reply = mine ? gatheringRsvpOf(mine.s) : null;
  const host = seated.find((r) => r.s.uid === g.hostUid)?.s.displayName || "the host";
  const when = gatheringWhenText(g);
  const members = await availableMembers(podId, g, isHost);
  if (!current()) return;
  const answer = async (value: "accepted" | "declined"): Promise<void> => {
    try {
      await gatheringRsvp(podId, g, value);
      showToast(value === "accepted" ? "You're in." : "Reply sent: can't make it.");
      await actions.refresh();
    } catch (error) {
      showToast("Could not send your reply: " + errorMessage(error));
    }
  };
  const linkAnswer =
    (value: "accepted" | "declined") =>
    (e: Event): void => {
      e.preventDefault();
      void answer(value);
    };
  const save = async (): Promise<void> => {
    try {
      await updateGatheringDetails(podId, g.id, {
        title: inputValue(content, "wtTitle"),
        whenDate: inputValue(content, "wtDate"),
        whenTime: inputValue(content, "wtTime"),
        place: inputValue(content, "wtPlace"),
      });
      showToast("Details updated.");
      await actions.refresh();
    } catch (error) {
      showToast("Could not save: " + errorMessage(error));
    }
  };
  const resend = async (): Promise<void> => {
    const ok = await notify(
      "invite",
      g.title || "Gathering",
      podId,
      g.id,
      pending.map((r) => r.s.uid),
    );
    showToast(
      ok
        ? `Invites sent again to ${pending.length} ${pending.length === 1 ? "person" : "people"}.`
        : "Could not confirm the invites went out. Try again.",
    );
  };
  const cancel = (): void =>
    gatheringRuntime().confirm(
      "Cancel this gathering? Everyone invited will be told.",
      "Cancel gathering",
      async () => {
        try {
          await cancelGathering(podId, g.id);
          const tell = seated.filter((r) => r.s.uid !== uid && !r.s.guest).map((r) => r.s.uid);
          if (tell.length) await notify("cancelled", g.title || "the gathering", podId, g.id, tell);
          actions.stop();
          closeTryADeckModal();
          gatheringRuntime().refreshPods();
          showToast("Gathering cancelled.");
        } catch (error) {
          showToast("Could not cancel: " + errorMessage(error));
          await actions.open();
        }
      },
      () => {
        void actions.open();
      },
      "Keep it",
    );
  const start = (): void => {
    if (inPlay.length < 2) {
      showToast("You need at least 2 people seated to start.");
      return;
    }
    const go = async (): Promise<void> => {
      try {
        for (const r of seated)
          if (gatheringRsvpOf(r.s) === "declined")
            await setGatheringSeat(podId, g.id, r.k, { uid: null, displayName: null, deck: null });
        await goLiveGathering(podId, g.id);
      } catch (error) {
        showToast("Could not start: " + errorMessage(error));
      }
      await actions.open();
    };
    if (pending.length)
      gatheringRuntime().confirm(
        `${pending.length} ${pending.length === 1 ? "person hasn't" : "people haven't"} replied yet. Start anyway? They stay seated and can still join.`,
        "Start now",
        go,
        () => {
          void actions.open();
        },
      );
    else void go();
  };
  const myBlock =
    !isHost && mine
      ? reply === "invited"
        ? html`<div class="g-rsvp-box">
            <div class="g-f13 g-mb8"><strong>${host}</strong> invited you. Can you make it?</div>
            <div class="row g-gap8">
              <button
                type="button"
                id="wtAcceptBtn"
                class="g-flex"
                @click=${() => answer("accepted")}
              >
                Accept
              </button>
              <button
                type="button"
                id="wtDeclineBtn"
                class="ghost g-flex"
                @click=${() => answer("declined")}
              >
                Can't make it
              </button>
            </div>
          </div>`
        : reply === "accepted"
          ? html`<p class="g-reply g-leaf">
              ✓ You're in.
              <a
                href="#"
                id="wtDeclineLink"
                class="g-reply-link g-soft"
                @click=${linkAnswer("declined")}
                >Can't make it after all</a
              >
            </p>`
          : html`<p class="g-reply g-danger">
              You said you can't make it.
              <a
                href="#"
                id="wtAcceptLink"
                class="g-reply-link g-gold"
                @click=${linkAnswer("accepted")}
                >Changed my mind — accept</a
              >
            </p>`
      : nothing;
  render(
    html` <h2 class="g-mb2">${g.title || "Gathering"}</h2>
      <p class="g-wait-subtitle">${`Waiting for replies — hosted by ${host}`}</p>
      ${when ? html`<p class="g-invite-title">${when}</p>` : nothing}
      <p class="g-confirmed">
        ${`${inPlay.length - pending.length} of ${inPlay.length} confirmed${pending.length ? ` · ${pending.length} still to reply` : ""}`}
      </p>
      ${myBlock}
      <div id="gatheringSeatsArea">${seatViews(podId, g, members, isHost, actions, true)}</div>
      ${
        isHost
          ? html`<div class="row g-gap8 g-start-row">
                <button type="button" id="wtStartBtn" class="g-flex" @click=${start}>
                  Start the gathering
                </button>
                ${pending.length ? html`<button type="button" id="wtResendBtn" class="ghost g-flex" @click=${resend}>${`Resend invites (${pending.length})`}</button>` : nothing}
              </div>
              <div class="row g-gap8">
                <button
                  type="button"
                  id="wtEditBtn"
                  class="ghost g-flex g-f125"
                  @click=${() => {
                    const form = content.querySelector<HTMLElement>("#wtEditForm")!;
                    form.hidden = !form.hidden;
                  }}
                >
                  Edit details
                </button>
                <button
                  type="button"
                  id="wtCopyBtn"
                  class="ghost g-flex g-f125"
                  @click=${() => copyInvite(inviteMessage(g.title || "the gathering", g, host))}
                >
                  Copy invite message
                </button>
                <button
                  type="button"
                  id="wtCancelBtn"
                  class="ghost g-flex g-f125 g-danger-button"
                  @click=${cancel}
                >
                  Cancel it
                </button>
              </div>
              <div id="wtEditForm" hidden class="g-edit-form">
                <input
                  id="wtTitle"
                  type="text"
                  maxlength="80"
                  .value=${g.title || ""}
                  placeholder="Name"
                  class="g-input g-full g-mb8"
                />
                <div class="row g-gap8 g-mb8">
                  <input
                    id="wtDate"
                    type="date"
                    .value=${g.whenDate || ""}
                    class="g-input g-flex g-min0"
                  />
                  <input
                    id="wtTime"
                    type="time"
                    .value=${g.whenTime || ""}
                    class="g-input g-flex g-min0"
                  />
                </div>
                <input
                  id="wtPlace"
                  type="text"
                  maxlength="120"
                  .value=${g.place || ""}
                  placeholder="Where?"
                  class="g-input g-full g-mb8"
                />
                <button type="button" id="wtSaveBtn" class="g-full" @click=${save}>
                  Save changes
                </button>
              </div>`
          : html`<p class="g-waiting-message">
              ${`Waiting for ${host} to start the gathering.${mine ? " You can pick your deck now." : ""}`}
            </p>`
      }`,
    content,
  );
}
