import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildBenchmarkFiles,
  deckFeatures,
  median,
  NOT_IN_REFERENCE,
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

describe("committed precon benchmarks", () => {
  // Pinned golden fixtures: the card subset is proven to analyse every sample exactly as the
  // full card DB does (tests/golden/generate-fixture.mjs), and weekly data cannot move it.
  const samples = json("../../public/data/TRY_A_DECK_OPTIONS.json");
  const data = {
    cards: json("../../tests/golden/fixtures/cards.json"),
    spellbook: json("../../tests/golden/fixtures/spellbook.json"),
    winRates: json("../../tests/golden/fixtures/winrates.json"),
  };
  const frozen = json("./frozen-reference-rows.json");
  const files = buildBenchmarkFiles(deckFeatures(samples, data), frozen);

  // A failure means the engine or the samples changed what these files should hold. Refitting
  // moves the Deck Chart's Closest Match, staples and mana-base checks: run
  // `node pipelines/reference-corpus/benchmark-baselines.mjs --update-public-data` only as a
  // deliberate, documented change (see docs/changes/034).
  it.each(Object.keys(files))("public/data/%s.json is this builder's output", (name) => {
    expect(files[name]).toBe(read(`../../public/data/${name}.json`));
  });

  it("covers every sample deck, in sample order", () => {
    expect(JSON.parse(files.PRECON_FINGERPRINTS).map(([key]) => key)).toEqual(
      samples.map((s) => s.key),
    );
  });

  it("puts every sample but NOT_IN_REFERENCE into the reference set, then the frozen rows", () => {
    const tiers = JSON.parse(files.REFERENCE_TIERS);
    const included = samples.filter((s) => !NOT_IN_REFERENCE.includes(s.key));
    expect(tiers).toHaveLength(included.length + 50);
    expect(tiers.slice(0, included.length)).toEqual(
      included.map((s) => (s.source === "precon" ? "p" : "t")),
    );
    expect(JSON.parse(files.REFERENCE_SCORES).slice(included.length)).toEqual(
      frozen.rows.map(([, v]) => v),
    );
  });

  it("refuses implausible input", () => {
    expect(() => buildBenchmarkFiles(deckFeatures(samples.slice(0, 10), data), frozen)).toThrow(
      "Only 10 sample decks",
    );
  });
});
