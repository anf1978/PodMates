// Ranking order, forgiving matches and the commander identity filter.
import { expect, it } from "vitest";
import { cardFitsCommanderIdentity, cardPopularity, searchCards, searchNorm } from "./search";
import type { CardRecord } from "./tuple";

const card = (n: string, t = "Artifact", ci = "") => ({ n, t, ci }) as CardRecord;
const db = [
  card("Mountain Goat", "Creature — Goat", "R"),
  card("Mountain", "Basic Land — Mountain"),
  card("Shivan Dragon", "Creature — Dragon", "R"),
  card("Sol Ring"),
  card("Solemn Simulacrum"),
  card("Swords to Plowshares", "Instant", "W"),
  card("Kraum, Ludevic's Opus", "Legendary Creature — Zombie Horror", "UR"),
  card("Tymna the Weaver", "Legendary Creature — Human Cleric", "WB"),
  card("Lim-Dûl's Vault", "Instant", "UB"),
];
const names = (q: string, opts?: Parameters<typeof searchCards>[4], limit = 5) =>
  searchCards(db, new Map(), q, limit, opts).map((c) => c.n);

it("normalizes accents, apostrophes and punctuation", () => {
  expect(searchNorm("Lim-Dûl’s Vault")).toBe("lim duls vault");
});

it("ranks exact, then prefix, then later-word matches", () => {
  expect(names("mountain")).toEqual(["Mountain", "Mountain Goat"]);
  expect(names("dragon")).toEqual(["Shivan Dragon"]);
  expect(names("kraum tymna")).toEqual([]);
  expect(names("tymna weav")).toEqual(["Tymna the Weaver"]);
});

it("forgives typos and swapped letters when exact matches run short", () => {
  expect(names("swrds to plow")).toEqual(["Swords to Plowshares"]);
  expect(names("lim duls")).toEqual(["Lim-Dûl's Vault"]);
});

it("puts staples first within a group", () => {
  const popularity = cardPopularity(
    Array.from({ length: 10 }, () => ({ decklist: "1 Solemn Simulacrum\n1x Sol Ring" })),
  );
  expect(popularity.get("sol ring")).toBe(10);
  const ranked = searchCards(db, new Map([["solemn simulacrum", 12]]), "sol", 5).map((c) => c.n);
  expect(ranked).toEqual(["Solemn Simulacrum", "Sol Ring"]);
});

it("filters by commander colour identity", () => {
  expect(cardFitsCommanderIdentity({ ci: "UB" }, { ci: "WUB" })).toBe(true);
  expect(cardFitsCommanderIdentity({ ci: "R" }, { ci: "WUB" })).toBe(false);
  expect(names("mountain", { commanderCard: { ci: "W" } })).toEqual(["Mountain"]);
});
