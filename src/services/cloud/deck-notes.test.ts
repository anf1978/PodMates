import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadDeckNotes,
  loadSparkChecks,
  saveCardNote,
  saveDeckPrimer,
  saveSparkCheck,
} from "./deck-notes";
import { PM_LIMITS } from "./limits";
import * as fb from "./testing/fake-firebase";

vi.mock("./firebase", () => import("./testing/fake-firebase"));

const { fake } = fb;
const mine = { uid: "u1", id: "deck" };
const path = "users/u1/decks/deck/notes/current";

beforeEach(() => {
  fake.reset();
  fake.signIn({ uid: "u1", displayName: "Ann" });
  vi.spyOn(Date, "now").mockReturnValue(5);
});
afterEach(() => vi.restoreAllMocks());

describe("deck notes", () => {
  it("starts empty, and saves, replaces and removes card notes", async () => {
    expect(await loadDeckNotes(mine)).toEqual({
      primer: "",
      cards: {},
      shareForTuning: false,
      updatedAt: 0,
    });
    await saveCardNote(mine, "Sol Ring", {
      roles: ["ramp", "ramp", "nonsense" as never],
      text: " Fast ",
    });
    expect(fake.get(path)?.cards).toEqual({ "Sol Ring": { roles: ["ramp"], text: "Fast", at: 5 } });
    await saveCardNote(mine, "Arcane Signet", { roles: [], text: "Fixing" });
    await saveCardNote(mine, "Sol Ring", { roles: [], text: "" });
    expect(Object.keys((await loadDeckNotes(mine))!.cards)).toEqual(["Arcane Signet"]);
  });

  it("keeps card notes when the primer changes, and the reverse", async () => {
    await saveCardNote(mine, "Sol Ring", { roles: ["ramp"], text: "" });
    await saveDeckPrimer(mine, "  Line one\nLine two  ", true);
    await saveCardNote(mine, "Opt", { roles: ["draw"], text: "" });
    const notes = await loadDeckNotes(mine);
    expect(notes?.primer).toBe("Line one\nLine two");
    expect(notes?.shareForTuning).toBe(true);
    expect(Object.keys(notes!.cards)).toEqual(["Sol Ring", "Opt"]);
  });

  it("caps the primer, a note and the number of cards with notes", async () => {
    await saveDeckPrimer(mine, "x".repeat(PM_LIMITS.deckPrimer + 5), false);
    expect((fake.get(path)?.primer as string).length).toBe(PM_LIMITS.deckPrimer);
    await saveCardNote(mine, "Opt", { roles: [], text: "y".repeat(PM_LIMITS.cardNote + 5) });
    const cards = Object.fromEntries(
      Array.from({ length: PM_LIMITS.cardNotes }, (_, i) => [
        `Card ${i}`,
        { roles: ["draw"], text: "", at: 1 },
      ]),
    );
    fake.seed(path, { primer: "", cards, shareForTuning: false, updatedAt: 1 });
    await expect(saveCardNote(mine, "One more", { roles: ["ramp"], text: "" })).rejects.toThrow(
      `up to ${PM_LIMITS.cardNotes} cards`,
    );
    await saveCardNote(mine, "Card 0", { roles: ["ramp"], text: "edit is fine" });
  });

  it("only the owner writes", async () => {
    await expect(
      saveCardNote({ uid: "u2", id: "deck" }, "Opt", { roles: [], text: "hi" }),
    ).rejects.toThrow("owner");
  });
});

describe("Spark checks", () => {
  it("saves one answer per battle and lists them newest first", async () => {
    await saveSparkCheck(mine, "game1", "p1", "right", 6.4);
    vi.spyOn(Date, "now").mockReturnValue(9);
    await saveSparkCheck(mine, "game2", "p1", "stronger", Number.NaN);
    await saveSparkCheck(mine, "game1", "p1", "weaker", 6.4);
    expect(await loadSparkChecks(mine)).toEqual([
      { id: "game1", verdict: "weaker", spark: 6.4, at: 9, podId: "p1" },
      { id: "game2", verdict: "stronger", spark: null, at: 9, podId: "p1" },
    ]);
    await expect(saveSparkCheck(mine, "g", "p1", "great" as never, 1)).rejects.toThrow();
  });
});
