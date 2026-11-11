import { expect, it } from "vitest";
import {
  buildLookupIndexes,
  fuzzyFindCard,
  getCard,
  levenshtein,
  matchDecklist,
  normalizeName,
  normalizeSplitName,
} from "./lookup.ts";
import { cardFromTuple, type CardTuple } from "./tuple.ts";

const card = (name: string) =>
  cardFromTuple([name, "", "", "", "", 0, "", ""] as CardTuple, {
    gameChanger: false,
    banned: false,
  });
const db = ["Sol Ring", "Fire // Ice", "Dusk // Dawn", "Damn", "Lightning Bolt"].map(card);
const indexes = buildLookupIndexes(db);

it("normalises case and single-slash split names", () => {
  expect(normalizeName("Sol RING")).toBe("sol ring");
  expect(normalizeSplitName("Fire/Ice")).toBe("fire // ice");
  expect(normalizeSplitName("Fire / Ice")).toBe("fire // ice");
});

it("measures edit distance, including the empty-string edges", () => {
  expect(levenshtein("", "abc")).toBe(3);
  expect(levenshtein("abc", "")).toBe(3);
  expect(levenshtein("sol ring", "sol rng")).toBe(1);
});

it("resolves each match type in priority order", () => {
  expect(fuzzyFindCard("sol ring", db, indexes)).toEqual({ card: db[0], matchType: "exact" });
  expect(fuzzyFindCard("Fire/Ice", db, indexes)).toEqual({ card: db[1], matchType: "exact" });
  expect(fuzzyFindCard("Fire", db, indexes)).toEqual({ card: db[1], matchType: "dfc-front-face" });
  // "Dawn" must find its own split card rather than fuzzy-matching "Damn".
  expect(fuzzyFindCard("Dawn", db, indexes)).toEqual({ card: db[2], matchType: "dfc-back-face" });
  expect(fuzzyFindCard("Sol Rng", db, indexes)).toEqual({
    card: db[0],
    matchType: "fuzzy",
    distance: 1,
  });
});

it("refuses short names and distant candidates", () => {
  expect(fuzzyFindCard("Sol", db, indexes)).toBeNull();
  expect(fuzzyFindCard("Nonexistent Card", db, indexes)).toBeNull();
  expect(getCard("Nonexistent Card", db, indexes)).toBeNull();
  expect(getCard("Sol Ring", db, indexes)).toBe(db[0]);
});

it("splits a decklist into matches, misses and reported fuzzy substitutions", () => {
  const result = matchDecklist(
    [
      { qty: 1, name: "Sol Ring" },
      { qty: 2, name: "Sol Rng" },
      { qty: 1, name: "Nonexistent Card" },
    ],
    db,
    indexes,
  );
  expect(result.matched).toEqual([
    { qty: 1, card: db[0], originalName: "Sol Ring" },
    { qty: 2, card: db[0], originalName: "Sol Rng" },
  ]);
  expect(result.notFound).toEqual(["Nonexistent Card"]);
  expect(result.fuzzyMatches).toEqual([{ typed: "Sol Rng", matched: "Sol Ring" }]);
});
