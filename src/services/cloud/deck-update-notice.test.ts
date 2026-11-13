// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveDeck } from "./decks";
import {
  cardListChanged,
  cardListKey,
  claimDailyNotice,
  DAILY_MS,
  shouldAnnounceUpdate,
} from "./deck-update-notice";
import * as fb from "./testing/fake-firebase";

vi.mock("./firebase", () => import("./testing/fake-firebase"));

const { fake } = fb;
let now = 1_000;
// Activity is written in the background after the save resolves, so let it land first.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const deckNotices = async () => {
  await flush();
  return fake.writes
    .filter((w) => w.path.startsWith("pods/p1/activity/"))
    .map((w) => w.data as { ref?: string });
};

beforeEach(() => {
  fake.reset();
  localStorage.clear();
  fake.signIn({ uid: "u1", displayName: "Ann", email: "ann@example.com" });
  fake.seed("users/u1", { podIds: ["p1"] });
  now = 1_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
});

afterEach(() => vi.restoreAllMocks());

describe("card list comparison", () => {
  it("ignores order, blank lines, spacing and case", () => {
    expect(cardListKey("1 Sol Ring\n\n1  Arcane Signet ")).toBe(
      cardListKey("1 arcane signet\r\n1 Sol Ring"),
    );
    expect(cardListChanged("1 Sol Ring", "1 sol ring")).toBe(false);
    expect(cardListChanged("1 Sol Ring", "1 Sol Ring\n1 Mana Crypt")).toBe(true);
    expect(cardListChanged(null, "1 Sol Ring")).toBe(false); // unknown before: never a change
  });

  it("lets a deck announce once a day, per account and deck", () => {
    expect(claimDailyNotice("u1", "d1", 0)).toBe(true);
    expect(claimDailyNotice("u1", "d1", DAILY_MS - 1)).toBe(false);
    expect(claimDailyNotice("u1", "d2", 10)).toBe(true);
    expect(claimDailyNotice("u2", "d1", 10)).toBe(true);
    expect(claimDailyNotice("u1", "d1", DAILY_MS)).toBe(true);
    localStorage.setItem("pm_deck_update_notice_u1", "not json");
    expect(claimDailyNotice("u1", "d1", DAILY_MS + 1)).toBe(true); // storage trouble never blocks
  });

  it("never announces when told not to", () => {
    const args = { uid: "u1", deckId: "d", before: "1 A", after: "1 B", now: 0 };
    expect(shouldAnnounceUpdate(false, args)).toBe(false);
    expect(shouldAnnounceUpdate("now", args)).toBe(true);
    expect(shouldAnnounceUpdate("now", args)).toBe(true);
    expect(shouldAnnounceUpdate("daily", args)).toBe(true);
    expect(shouldAnnounceUpdate("daily", args)).toBe(false);
  });
});

describe("saveDeck notices", () => {
  const save = (list: string, extra = {}, options = {}) =>
    saveDeck("Atraxa (Ann)", { commander: "Atraxa", list, ...extra }, undefined, options);

  it("announces a new deck, then only real list changes as updates", async () => {
    await save("1 Sol Ring");
    await save("1 sol ring\n"); // same cards
    await save("1 Sol Ring\n1 Mana Crypt");
    await save("1 Sol Ring\n1 Mana Crypt", { deckName: "Renamed" }); // rename only
    const notices = await deckNotices();
    expect(notices).toEqual([
      expect.objectContaining({ type: "deck", subject: "Atraxa (Ann)" }),
      expect.objectContaining({ type: "deck", subject: "Atraxa (Ann)", ref: "updated" }),
    ]);
    expect(notices[0]).not.toHaveProperty("ref");
  });

  it("keeps secret decks, restores and repairs quiet", async () => {
    await save("1 Sol Ring", { secret: true });
    await save("1 Mana Crypt", { secret: true });
    await save("1 Arcane Signet", {}, { updateNotice: false });
    expect(await deckNotices()).toEqual([]);
  });

  it("limits automatic syncs to one update notice per deck per day", async () => {
    await save("1 A");
    await save("1 B", {}, { updateNotice: "daily" });
    now += 60_000;
    await save("1 C", {}, { updateNotice: "daily" });
    now += DAILY_MS;
    await save("1 D", {}, { updateNotice: "daily" });
    expect((await deckNotices()).filter((d) => d.ref === "updated")).toHaveLength(2);
  });

  it("sends no update notice when the old deck could not be read", async () => {
    await save("1 A");
    vi.spyOn(fb, "getDoc").mockRejectedValueOnce(new Error("offline"));
    await save("1 B");
    expect(await deckNotices()).toHaveLength(1);
  });
});
