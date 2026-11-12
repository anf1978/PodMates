// Gathering cards on My Pods; consumes pod data without importing the pods feature.
import { html, render, nothing } from "../../ui/html";
import { showToast } from "../../ui/toast";
import { gatheringRsvp, errorMessage } from "./controls";
import {
  gatheringRsvpOf,
  gatheringWhenText,
  gatheringIsStale,
  occupied,
  type LandingGathering,
} from "./state";

export function paintOpenGatherings(
  area: HTMLElement | null,
  all: LandingGathering[],
  uid: string,
  open: (podId: string, id: string) => Promise<void>,
): void {
  if (!area) return;
  render(
    html`${all.map((g) => {
      const mine = occupied(g).find((r) => r.s.uid === uid)?.s;
      if (!mine) return nothing;
      const title = g.title || "Gathering",
        when = gatheringWhenText(g);
      const tag = `${g.podId}|${g.id}`;
      const join = (): Promise<void> => open(g.podId, g.id);
      if (g.status === "live")
        return html`<button
          type="button"
          data-open-gathering=${tag}
          class="g-live-card"
          @click=${join}
        >
          ${`Join Gathering — ${title}`}
          <span class="g-live-card-pod">${`(${g.podName || ""})`}</span>
        </button>`;
      if (g.status !== "proposed" || gatheringIsStale(g)) return nothing;
      const seats = occupied(g).filter((r) => gatheringRsvpOf(r.s) !== "declined");
      const accepted = seats.filter((r) => gatheringRsvpOf(r.s) !== "invited").length;
      if (g.hostUid === uid)
        return html`<button
          type="button"
          data-open-gathering=${tag}
          class="ghost g-wait-card"
          @click=${join}
        >
          ${`Waiting for replies — ${title}`}<br /><span class="g-f12 g-soft"
            >${`${accepted} of ${seats.length} confirmed${when ? " · " + when : ""}`}</span
          >
        </button>`;
      const answer =
        (value: "accepted" | "declined") =>
        async (e: Event): Promise<void> => {
          const button = e.currentTarget as HTMLButtonElement;
          button.disabled = true;
          try {
            await gatheringRsvp(g.podId, g, value);
            showToast(value === "accepted" ? "You're in." : "Reply sent: can't make it.");
          } catch (error) {
            button.disabled = false;
            showToast("Could not send your reply: " + errorMessage(error));
          }
        };
      if (gatheringRsvpOf(mine) === "invited")
        return html`<div class="g-invited-card">
          <div class="g-f135"><strong>You're invited:</strong> ${title}</div>
          <div class="g-card-details">${`${g.podName || ""}${when ? " · " + when : ""}`}</div>
          <div class="row g-gap8">
            <button
              type="button"
              data-rsvp=${`accepted|${tag}`}
              class="g-flex g-f125"
              @click=${answer("accepted")}
            >
              Accept
            </button>
            <button
              type="button"
              class="ghost g-flex g-f125"
              data-rsvp=${`declined|${tag}`}
              @click=${answer("declined")}
            >
              Can't make it
            </button>
            <button type="button" class="ghost g-f125" data-open-gathering=${tag} @click=${join}>
              Details
            </button>
          </div>
        </div>`;
      if (gatheringRsvpOf(mine) === "accepted")
        return html`<button
          type="button"
          data-open-gathering=${tag}
          class="ghost g-accepted-card"
          @click=${join}
        >
          ${`✓ You're in — ${title}`}<br />
          <span class="g-f12 g-soft"
            >${`${when ? when + " · " : ""}waiting for the host to start`}</span
          >
        </button>`;
      return nothing;
    })}`,
    area,
  );
}
