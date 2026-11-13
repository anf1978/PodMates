import { beforeEach, describe, expect, it, vi } from "vitest";

const cloud = vi.hoisted(() => ({
  user: { uid: "me" } as { uid: string } | null,
  decks: {} as Record<string, unknown>,
  loadAllDecks: vi.fn(),
  saveDeck: vi.fn(),
  loadMyPods: vi.fn(),
  loadPodMembers: vi.fn(),
  loadPodmateDecksRaw: vi.fn(),
}));
vi.mock("./cloud/session", () => ({
  getCurrentUser: () => cloud.user,
  isCloudReady: () => true,
}));
vi.mock("./cloud/decks", () => ({
  loadAllDecks: cloud.loadAllDecks,
  saveDeck: cloud.saveDeck,
  loadPodmateDecksRaw: cloud.loadPodmateDecksRaw,
}));
vi.mock("./cloud/pods", () => ({ loadMyPods: cloud.loadMyPods }));
vi.mock("./cloud/members", () => ({ loadPodMembers: cloud.loadPodMembers }));
vi.mock("./report-error", () => ({
  reportOperation: (fn: (...a: unknown[]) => unknown) => fn,
}));

import {
  loadSavedDecks,
  mergeSavedDecks,
  podmateSavedDecks,
  refreshPodmateDecks,
  refreshSavedDecks,
} from "./saved-decks";
import { PM_LIMITS } from "./cloud/limits";

const deck = (savedAt: number) => ({ list: "1 Sol Ring", commander: "A", player: "P", savedAt });

beforeEach(() => {
  vi.clearAllMocks();
  cloud.user = { uid: "me" };
  cloud.decks = {};
  cloud.loadAllDecks.mockImplementation(async () => ({ ...cloud.decks }));
  cloud.saveDeck.mockImplementation(async (key: string, entry: unknown) => {
    if (key === "bad") throw new Error("too large");
    cloud.decks[key] = entry;
  });
});

describe("refreshSavedDecks", () => {
  it("keeps the last good list when a load fails, and empties it when signed out", async () => {
    cloud.decks = { One: deck(1) };
    expect(await refreshSavedDecks()).toBe(true);
    expect(Object.keys(loadSavedDecks())).toEqual(["One"]);
    vi.useFakeTimers();
    cloud.loadAllDecks.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failed = refreshSavedDecks();
    await vi.runAllTimersAsync();
    expect(await failed).toBe(false);
    vi.useRealTimers();
    expect(Object.keys(loadSavedDecks())).toEqual(["One"]);
    cloud.user = null;
    expect(await refreshSavedDecks()).toBe(true);
    expect(loadSavedDecks()).toEqual({});
  });
});

describe("mergeSavedDecks", () => {
  it("adds new decks, keeps the newer copy and counts failures", async () => {
    cloud.decks = { Same: deck(5), Older: deck(1) };
    await refreshSavedDecks();
    const result = await mergeSavedDecks({
      Same: deck(5),
      Older: deck(9),
      Fresh: "1 Island",
      bad: deck(1),
    });
    expect(result).toEqual({ added: 1, updated: 1, skipped: 1, overLimit: 0, failed: 1, total: 4 });
    expect(cloud.saveDeck).toHaveBeenCalledWith(
      "Fresh",
      { list: "1 Island", commander: "", player: "", savedAt: 0 },
      undefined,
      { updateNotice: false }, // restoring a backup never announces deck updates
    );
    expect(Object.keys(loadSavedDecks()).sort()).toEqual(["Fresh", "Older", "Same"]);
  });

  it("stops adding at the saved-deck cap", async () => {
    cloud.decks = Object.fromEntries(
      Array.from({ length: PM_LIMITS.maxSavedDecks - 1 }, (_, i) => [`d${i}`, deck(1)]),
    );
    await refreshSavedDecks();
    const result = await mergeSavedDecks({ x: deck(1), y: deck(1) });
    expect(result).toMatchObject({ added: 1, overLimit: 1 });
  });
});

it("collects podmates' shared decks across pods, keyed apart from mine", async () => {
  cloud.loadMyPods.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
  cloud.loadPodMembers.mockImplementation(async (pod: string) =>
    pod === "p1"
      ? [{ uid: "me" }, { uid: "u2", displayLabel: "Bo" }]
      : [{ uid: "u2" }, { uid: "u3", displayName: "Cy" }],
  );
  cloud.loadPodmateDecksRaw.mockImplementation(async (uid: string) => {
    if (uid === "u3") throw Object.assign(new Error("denied"), { code: "permission-denied" });
    return { Deck: deck(1) };
  });
  vi.useFakeTimers(); // a denial is retried like any failure before it counts as "nothing shared"
  const done = refreshPodmateDecks();
  await vi.runAllTimersAsync();
  vi.useRealTimers();
  expect(await done).toEqual({ ok: true, partial: false });
  expect(podmateSavedDecks()).toEqual({
    "pm:u2:Deck": { ...deck(1), mine: false, ownerUid: "u2", ownerName: "Bo" },
  });
});
