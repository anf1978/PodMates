import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildBaselines,
  deckFeatures,
  EXCLUDED_FROM_NOV_3_FIT,
  median,
  roundHalfEven3,
} from "./benchmark-baselines.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const json = (path) => JSON.parse(read(path));

describe("Python-compatible arithmetic", () => {
  it("takes the middle value, or the mean of the two middle values", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrow();
  });

  it("rounds like Python's round(x, 3) on the float's exact value", () => {
    // Expected values printed by CPython 3: round(x, 3).
    expect(roundHalfEven3(0.6085)).toBe(0.609); // stored just above the half
    expect(roundHalfEven3(0.5625)).toBe(0.562); // exact half, to even
    expect(roundHalfEven3(0.5635)).toBe(0.564);
    expect(roundHalfEven3(0.0005)).toBe(0.001);
    expect(roundHalfEven3(2.675)).toBe(2.675);
    expect(roundHalfEven3(1)).toBe(1);
  });
});

describe("Nov 3, 2026 benchmark refit", () => {
  // Pinned golden fixtures: the card subset is proven to analyse every sample exactly as the
  // full card DB does (tests/golden/generate-fixture.mjs), and weekly data cannot move it.
  const samples = json("../../public/data/TRY_A_DECK_OPTIONS.json");
  const data = {
    cards: json("../../tests/golden/fixtures/cards.json"),
    spellbook: json("../../tests/golden/fixtures/spellbook.json"),
    winRates: json("../../tests/golden/fixtures/winrates.json"),
  };
  const fitted = samples.filter((s) => !EXCLUDED_FROM_NOV_3_FIT.includes(s.key));
  const { staples, manabase } = buildBaselines(deckFeatures(fitted, data));

  it("fits the 174 decks the committed files describe", () => {
    expect(fitted).toHaveLength(174);
    expect(EXCLUDED_FROM_NOV_3_FIT.every((key) => samples.some((s) => s.key === key))).toBe(true);
  });

  it("reproduces the committed STAPLES_BASELINE byte for byte", () => {
    expect(`${JSON.stringify(staples)}\n`).toBe(read("../../public/data/STAPLES_BASELINE.json"));
  });

  it("reproduces the committed MANABASE_BASELINE byte for byte", () => {
    expect(`${JSON.stringify(manabase)}\n`).toBe(read("../../public/data/MANABASE_BASELINE.json"));
  });
});
