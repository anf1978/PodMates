// Behaviour tests for the Deck Chart rules: the copy limits that make some cards exempt
// from singleton, the structural checks behind the Structure & Legality panel, and the
// Cost vs. Production shares in the Mana Base panel.

import { describe, expect, it } from "vitest";
import type { CardRecord } from "../../cards/tuple.ts";
import type { MatchedCard } from "../../cards/lookup.ts";
import { checkLegality, getCopyLimit, manaBaseRows } from "./state.ts";

function card(overrides: Partial<CardRecord> & { n: string }): CardRecord {
  return {
    t: "Creature",
    o: "",
    c: "",
    ci: "",
    m: 1,
    p: "",
    r: "common",
    g: false,
    b: false,
    ...overrides,
  };
}

function matched(entries: Array<[CardRecord, number]>): MatchedCard[] {
  return entries.map(([c, qty]) => ({ qty, card: c, originalName: c.n }));
}

/** 99 unremarkable cards so the count and land checks stay quiet. */
function filler(count: number, from = 0): MatchedCard[] {
  return matched(
    Array.from({ length: count }, (_, i) => [
      card({ n: `Filler ${from + i}`, t: i < 36 ? "Land" : "Creature" }),
      1,
    ]),
  );
}

describe("getCopyLimit", () => {
  it("defaults to one copy", () => {
    expect(getCopyLimit(card({ n: "Llanowar Elves" }))).toBe(1);
  });

  it("reads 'any number' from the card's own text", () => {
    const rats = card({
      n: "Rat Colony",
      o: "A deck can have any number of cards named Rat Colony.",
    });
    expect(getCopyLimit(rats)).toBe(Infinity);
  });

  it("reads a spelled-out 'up to N' limit", () => {
    const dwarves = card({
      n: "Seven Dwarves",
      o: "A deck can have up to seven cards named Seven Dwarves.",
    });
    expect(getCopyLimit(dwarves)).toBe(7);
  });

  it("falls back to the pinned list when the text is missing", () => {
    expect(getCopyLimit(card({ n: "Nazg\u00FBl" }))).toBe(9);
  });
});

describe("checkLegality", () => {
  const commander = card({ n: "Uril, the Miststalker", ci: "RGW", t: "Legendary Creature" });

  it("passes a plain 100-card list inside the commander's identity", () => {
    const report = checkLegality({
      matched: [...matched([[commander, 1]]), ...filler(99)],
      commanders: ["Uril, the Miststalker"],
      notFound: [],
      commanderCards: [commander],
    });
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.total).toBe(100);
  });

  it("reports duplicates but exempts cards whose text allows them", () => {
    const petitioners = card({
      n: "Persistent Petitioners",
      o: "A deck can have any number of cards named Persistent Petitioners.",
    });
    const report = checkLegality({
      matched: [
        ...matched([
          [commander, 1],
          [card({ n: "Sol Ring", t: "Artifact" }), 2],
          [petitioners, 20],
          [card({ n: "Forest", t: "Basic Land — Forest" }), 10],
        ]),
        ...filler(67),
      ],
      commanders: ["Uril, the Miststalker"],
      notFound: [],
      commanderCards: [commander],
    });
    expect(report.dupes).toEqual(["Sol Ring"]);
    expect(report.hardViolations.some((v) => v.includes("Singleton violations"))).toBe(true);
    expect(report.hardViolations.some((v) => v.includes("Persistent Petitioners"))).toBe(false);
  });

  it("flags banned cards and cards outside the commander's colour identity", () => {
    const report = checkLegality({
      matched: matched([
        [commander, 1],
        [card({ n: "Black Lotus", t: "Artifact", b: true }), 1],
        [card({ n: "Counterspell", ci: "U" }), 1],
      ]),
      commanders: ["Uril, the Miststalker"],
      notFound: [],
      commanderCards: [commander],
    });
    expect(report.banned).toEqual(["Black Lotus"]);
    expect(report.hardViolations.some((v) => v.includes("Banned in Commander"))).toBe(true);
    expect(
      report.hardViolations.some((v) => v.includes("color identity (RGW): Counterspell")),
    ).toBe(true);
  });

  it("rejects a second commander with no partner-style text", () => {
    const second = card({ n: "Krenko, Mob Boss", ci: "R", t: "Legendary Creature" });
    const report = checkLegality({
      matched: matched([
        [commander, 1],
        [second, 1],
      ]),
      commanders: ["Uril, the Miststalker", "Krenko, Mob Boss"],
      notFound: [],
      commanderCards: [commander, second],
    });
    expect(report.hardViolations.some((v) => v.includes("2 commanders named"))).toBe(true);
  });

  it("accepts a partner pair", () => {
    const a = card({ n: "Thrasios, Triton Hero", ci: "GU", o: "Partner" });
    const b = card({ n: "Tymna the Weaver", ci: "WB", o: "Partner" });
    const report = checkLegality({
      matched: matched([
        [a, 1],
        [b, 1],
      ]),
      commanders: ["Thrasios, Triton Hero", "Tymna the Weaver"],
      notFound: [],
      commanderCards: [a, b],
    });
    expect(report.hardViolations).toEqual([]);
  });
});

describe("manaBaseRows", () => {
  it("compares each colour's share of pips against its share of sources", () => {
    const rows = manaBaseRows({ W: 30, U: 10, C: 0 }, { W: 10, U: 30, C: 5 });
    expect(rows.map((r) => r.color)).toEqual(["W", "U"]);
    expect(rows[0].costShare).toBeCloseTo(0.75);
    expect(rows[0].productionShare).toBeCloseTo(0.25);
    expect(rows[0].gapPoints).toBe(50);
    expect(rows[0].shortfall).toBe(true);
    expect(rows[1].shortfall).toBe(false);
  });

  it("scales the widest bar to fill its track", () => {
    const rows = manaBaseRows({ W: 30, U: 10 }, { W: 10, U: 30 });
    expect(Math.max(...rows.flatMap((r) => [r.costBarPercent, r.productionBarPercent]))).toBe(100);
  });

  it("only treats colourless as a colour when the deck has {C} costs", () => {
    expect(manaBaseRows({ W: 4 }, { W: 10, C: 6 }).map((r) => r.color)).toEqual(["W"]);
    expect(manaBaseRows({ W: 4, C: 2 }, { W: 10, C: 6 }).map((r) => r.color)).toEqual(["W", "C"]);
  });

  it("returns no rows for a deck with no coloured costs or sources", () => {
    expect(manaBaseRows({}, {})).toEqual([]);
  });
});
