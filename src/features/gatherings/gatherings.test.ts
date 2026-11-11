// Seat and waiting-state invariants retained during extraction.
import { describe, expect, it } from "vitest";
import { collectSeats, gatheringIsStale, gatheringRsvpOf, restoreLineup } from "./state";
import type { Gathering } from "../../services/cloud/gatherings";

describe("gathering seats", () => {
  const members = [{ uid: "host" }, { uid: "friend", displayLabel: "Friend" }];
  it("invites podmates, accepts guests, and rejects unnamed guest seats", () => {
    const assignments = ["host", "friend", { guest: " Visitor " }, null, null, null];
    const result = collectSeats(assignments, members, "invite");
    expect(result).toMatchObject({
      count: 3,
      invitees: ["friend"],
      inviteeNames: ["Friend"],
      guestNames: ["Visitor"],
      seats: {
        "1": { uid: "friend", rsvp: "invited", deck: null },
        "2": { displayName: "Visitor", guest: true, rsvp: "accepted", deck: null },
      },
    });
    expect(assignments[2]).toEqual({ guest: " Visitor " });
    expect(collectSeats(["host", { guest: "  " }], members, "now")).toEqual({
      error: "Seat 2 is a guest seat with no name yet.",
    });
    expect(collectSeats(["host", "friend"], members, "now")).toMatchObject({
      invitees: [],
      seats: { "1": { rsvp: "accepted" } },
    });
  });

  it("restores only current members and named guests without replacing the host", () => {
    const saved = [
      { uid: "other-host" },
      { uid: "departed" },
      { uid: "friend" },
      { guest: true, displayName: "Visitor" },
      null,
      { guest: true },
    ];
    expect(restoreLineup(saved, members, "host")).toEqual([
      "host",
      null,
      "friend",
      { guest: "Visitor" },
      null,
      null,
    ]);
    expect(saved[0]).toEqual({ uid: "other-host" });
  });
});

it("keeps older seats accepted and expires only proposed gatherings after the grace period", () => {
  expect(gatheringRsvpOf({ uid: "old", displayName: "Old seat", deck: null })).toBe("accepted");
  const g: Gathering = {
    id: "g",
    title: "",
    hostUid: "host",
    status: "proposed",
    seats: {},
    createdAt: new Date(2026, 10, 1).getTime(),
    whenDate: "2026-11-05",
  };
  const deadline = new Date(2026, 10, 7).getTime();
  expect(gatheringIsStale(g, deadline)).toBe(false);
  expect(gatheringIsStale(g, deadline + 1)).toBe(true);
  expect(gatheringIsStale({ ...g, status: "live" }, deadline + 1)).toBe(false);
  expect(gatheringIsStale({ ...g, whenDate: undefined }, g.createdAt + 7 * 86400000)).toBe(false);
  expect(gatheringIsStale({ ...g, whenDate: undefined }, g.createdAt + 7 * 86400000 + 1)).toBe(
    true,
  );
});
