// Filtering and routing preserve the inbox's device-local, opt-out behaviour.
import { expect, it } from "vitest";
import type { ActivityItem } from "../../services/cloud/activity";
import { ago, initialState, opensGathering, unreadCount, visible } from "./state";

const now = 1800000000000;
const item = (id: string, extra: Partial<ActivityItem> = {}): ActivityItem => ({
  id,
  podId: "pod",
  type: "deck",
  by: "friend",
  byName: "Friend",
  subject: "Deck",
  createdAt: now - 1000,
  ...extra,
});

it("merges feeds newest-first, excluding own, addressed, old, unknown and disabled activity", () => {
  const state = initialState();
  state.uid = "me";
  state.seenAt = now - 2000;
  state.prefs = { types: { joined: false }, muted: { muted: true } };
  state.feeds.set("pod", [
    item("old-read", { createdAt: now - 3000 }),
    item("own", { by: "me" }),
    item("private", { to: ["other"] }),
    item("invite", { type: "invite", to: ["me"], ref: "game" }),
    item("unknown", { type: "toString" }),
    item("disabled", { type: "joined" }),
    item("missing-date", { createdAt: 0 }),
    item("expired", { createdAt: now - 30 * 86400000 - 1 }),
  ]);
  state.feeds.set("muted", [item("muted")]);
  state.feeds.set("second", [item("newest", { createdAt: now })]);
  expect(visible(state, now).map((i) => i.id)).toEqual(["newest", "invite", "old-read"]);
  expect(unreadCount(state, now)).toBe(2);
  const invite = visible(state, now)[1];
  expect(opensGathering(invite)).toBe(true);
  expect(opensGathering({ ...invite, ref: undefined })).toBe(false);
  expect(opensGathering({ ...invite, type: "deck" })).toBe(false);
});

it("retains the thirty-day boundary, strict seen cutoff and relative-time rounding", () => {
  const state = initialState();
  state.uid = "me";
  state.seenAt = now;
  state.feeds.set("pod", [
    item("boundary", { createdAt: now - 30 * 86400000 }),
    item("seen", { createdAt: now }),
  ]);
  expect(visible(state, now)).toHaveLength(2);
  expect(unreadCount(state, now)).toBe(0);
  expect(ago(now + 60000, now)).toBe("just now");
  expect(ago(now - 120000, now)).toBe("2 min ago");
  expect(ago(now - 3600000, now)).toBe("1 h ago");
  expect(ago(now - 86400000, now)).toBe("1 day ago");
  expect(ago(now - 2 * 86400000, now)).toBe("2 days ago");
});
