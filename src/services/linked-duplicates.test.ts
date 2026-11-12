import { describe, expect, it } from "vitest";
import { dropLinkedDuplicates, isLinkedMirror, linkedSite } from "./linked-duplicates";

const list = (...names: string[]) => names.map((n) => `1 ${n}`).join("\n");
const cards = ["Sol Ring", "Arcane Signet", "Command Tower", "Counterspell", "Brainstorm"];

describe("dropLinkedDuplicates", () => {
  it("hides the owner's linked mirror of a saved deck and marks the kept one", () => {
    const saved = { commander: "Talrand, Sky Summoner", list: list(...cards), docId: "talrand" };
    const mirror = {
      commander: "Talrand, Sky Summoner",
      list: list(...cards.slice(0, 4)),
      docId: "linked-moxfield-abc",
    };
    const kept = dropLinkedDuplicates([saved, mirror]);
    expect(kept).toEqual([saved]);
    expect(saved).toMatchObject({ linkedVia: "Moxfield" });
  });

  it("keeps mirrors of other owners, other commanders and different lists", () => {
    const mine = { commander: "Talrand, Sky Summoner", list: list(...cards), docId: "t" };
    const theirs = { ...mine, docId: "linked-archidekt-1", ownerUid: "u2" };
    const otherCommander = { ...mine, commander: "Kenrith", docId: "linked-archidekt-2" };
    const otherList = { commander: "", list: list("Island", "Forest"), docId: "linked-moxfield-3" };
    const all = [mine, theirs, otherCommander, otherList];
    expect(dropLinkedDuplicates(all)).toEqual(all);
    expect(mine).not.toHaveProperty("linkedVia");
  });

  it("clears a stale mark when the mirror is gone", () => {
    const deck = { commander: "A", list: list("Sol Ring"), linkedVia: "Moxfield" };
    dropLinkedDuplicates([deck]);
    expect(deck).not.toHaveProperty("linkedVia");
  });
});

it("names the linked site from the mirror id", () => {
  expect(linkedSite("linked-moxfield-123")).toBe("Moxfield");
  expect(linkedSite("linked-archidekt-9")).toBe("Archidekt");
  expect(linkedSite("linked-other-9")).toBe("other");
  expect(linkedSite("plain")).toBe("");
  expect(isLinkedMirror({ docId: "linked-x-1" })).toBe(true);
  expect(isLinkedMirror({ docId: "x" })).toBe(false);
  expect(isLinkedMirror("linked-x-1")).toBe(false);
});
