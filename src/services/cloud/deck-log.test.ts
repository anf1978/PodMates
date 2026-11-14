import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changeDeckWins,
  configureDeckLog,
  countBattles,
  diffCards,
  loadDeckLog,
  recordDeckChart,
  setDeckChangeNote,
} from "./deck-log";
import { saveDeck } from "./decks";
import * as fb from "./testing/fake-firebase";

vi.mock("./firebase", () => import("./testing/fake-firebase"));

const { fake } = fb;
let now = 1_000;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const mine = { uid: "u1", id: "Atraxa%20(Ann)" };
const changes = () =>
  [...fake.store.keys()].filter((p) => p.startsWith(`users/u1/decks/${mine.id}/changes/`));

beforeEach(() => {
  fake.reset();
  fake.signIn({ uid: "u1", displayName: "Ann", email: "ann@example.com" });
  fake.seed("users/u1", { podIds: ["p1"] });
  now = 1_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  configureDeckLog({ sparkOf: (list) => list.split("\n").length });
});
afterEach(() => vi.restoreAllMocks());

describe("diffCards", () => {
  it("lists added and removed copies, ignoring order and case", () => {
    expect(
      diffCards("1 Sol Ring\n2 Island\n1 Counterspell", "1 sol ring\n3 Island\n1 Brainstorm"),
    ).toEqual({
      added: ["1 Island", "1 Brainstorm"],
      removed: ["1 Counterspell"],
    });
    expect(diffCards("1 A\n1 B", "1 B\n1 A")).toEqual({ added: [], removed: [] });
  });
});

describe("saving", () => {
  it("stamps the first save, keeps counters on re-save, and logs card changes with Spark", async () => {
    await saveDeck("Atraxa (Ann)", { commander: "Atraxa", list: "1 Sol Ring" });
    expect(fake.get(`users/u1/decks/${mine.id}`)).toMatchObject({ firstSavedAt: 1_000 });
    await fb.updateDoc(fb.doc(fb.db, "users", "u1", "decks", mine.id), { chartCount: 4, wins: 2 });
    now = 2_000;
    await saveDeck("Atraxa (Ann)", { commander: "Atraxa", list: "1 Sol Ring\n1 Mana Crypt" });
    await flush();
    expect(fake.get(`users/u1/decks/${mine.id}`)).toMatchObject({
      firstSavedAt: 1_000,
      chartCount: 4,
      wins: 2,
      list: "1 Sol Ring\n1 Mana Crypt",
    });
    expect(changes().map((p) => fake.get(p))).toEqual([
      { at: 2_000, added: ["1 Mana Crypt"], removed: [], sparkBefore: 1, sparkAfter: 2 },
    ]);
    await saveDeck("Atraxa (Ann)", { commander: "Atraxa", list: "1 mana crypt\n1 sol ring" });
    await saveDeck("Atraxa (Ann)", { commander: "Atraxa", list: "1 Sol Ring" }, undefined, {
      updateNotice: false,
    });
    await flush();
    expect(changes()).toHaveLength(1); // unchanged list and a restore add nothing
  });

  it("keeps only the newest 50 changes", async () => {
    await saveDeck("Atraxa (Ann)", { commander: "Atraxa", list: "1 Card 0" });
    for (let i = 1; i <= 52; i++) {
      now = 1_000 + i;
      await saveDeck("Atraxa (Ann)", { commander: "Atraxa", list: `1 Card ${i}` });
      await flush();
      await flush();
    }
    const kept = changes().map((p) => fake.get(p)?.at as number);
    expect(kept).toHaveLength(50);
    expect(Math.min(...kept)).toBe(1_003);
  });
});

describe("counters and notes", () => {
  beforeEach(async () => {
    await saveDeck("Atraxa (Ann)", { commander: "Atraxa", list: "1 Sol Ring" });
  });

  it("counts the owner's charts and podmates' views separately", async () => {
    now = 5_000;
    await recordDeckChart(mine);
    expect(fake.get(`users/u1/decks/${mine.id}`)).toMatchObject({
      chartCount: 1,
      lastChartedAt: 5_000,
      lastChartedBy: "Ann",
    });
    fake.signIn({ uid: "u2", displayName: "Bo", email: "bo@example.com" });
    now = 6_000;
    await recordDeckChart(mine);
    await recordDeckChart(mine);
    expect(fake.get(`users/u1/decks/${mine.id}`)).toMatchObject({
      chartCount: 1,
      podViewCount: 2,
      lastChartedAt: 6_000,
      lastChartedBy: "Bo",
    });
  });

  it("never counts a podmate's view of a secret deck", async () => {
    await fb.updateDoc(fb.doc(fb.db, "users", "u1", "decks", mine.id), { secret: true });
    fake.signIn({ uid: "u2", displayName: "Bo", email: "bo@example.com" });
    await recordDeckChart(mine);
    expect(fake.get(`users/u1/decks/${mine.id}`)).not.toHaveProperty("podViewCount");
  });

  it("lets only the owner add and undo wins, never below zero", async () => {
    expect(await changeDeckWins(mine, 1)).toBe(1);
    expect(await changeDeckWins(mine, -1)).toBe(0);
    expect(await changeDeckWins(mine, -1)).toBe(0);
    fake.signIn({ uid: "u2", displayName: "Bo", email: "bo@example.com" });
    await expect(changeDeckWins(mine, 1)).rejects.toThrow("Only the deck's owner");
  });

  it("edits a change note (owner only) and loads the whole log", async () => {
    now = 2_000;
    await saveDeck("Atraxa (Ann)", { commander: "Atraxa", list: "1 Mana Crypt" });
    await flush();
    const [path] = changes();
    const id = path!.split("/").pop()!;
    await setDeckChangeNote(mine, id, "  faster mana  ");
    expect(fake.get(path!)).toMatchObject({ note: "faster mana" });
    const log = await loadDeckLog(mine);
    expect(log?.deck).toMatchObject({ firstSavedAt: 1_000, list: "1 Mana Crypt" });
    expect(log?.changes.map((c) => c.note)).toEqual(["faster mana"]);
    expect(log?.battles).toEqual({ exact: 0, approximate: 0 });
    expect(await loadDeckLog({ uid: "u1", id: "missing" })).toBeNull();
  });
});

describe("countBattles", () => {
  const ref = { uid: "u1", id: "d1" };
  it("counts exact deck references, and older entries by player and commander as approximate", () => {
    const entries = [
      { decks: [{ uid: "u1", commander: "Atraxa", deckRef: { uid: "u1", id: "d1" } }] },
      { decks: [{ uid: "u1", commander: "Atraxa", deckRef: { uid: "u1", id: "other" } }] },
      {
        decks: [
          { uid: "u1", commander: "atraxa" },
          { uid: "u2", commander: "Atraxa" },
        ],
      },
      { decks: [{ uid: "u2", commander: "Atraxa" }] },
      { decks: [{ uid: "u1", commander: "Kraum / Tymna" }] },
      { decks: "bad" },
    ];
    expect(countBattles(ref, { commander: "Atraxa" }, entries as never)).toEqual({
      exact: 1,
      approximate: 1,
    });
    expect(countBattles(ref, { commander: "Tymna / Kraum" }, entries as never)).toEqual({
      exact: 1,
      approximate: 1,
    });
  });
});
