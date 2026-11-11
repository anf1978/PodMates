import { beforeEach, describe, expect, it, vi } from "vitest";

const loadDataset = vi.fn();
vi.mock("../data/load-dataset", () => ({ loadDataset }));

/** A 27-dimension fingerprint with one theme set. */
function unit(i: number): number[] {
  return Array.from({ length: 27 }, (_, j) => (j === i ? 1 : 0));
}

beforeEach(() => {
  vi.resetModules();
  loadDataset.mockReset();
});

describe("reference data", () => {
  it("loads the analysis datasets once and keeps only the available sample decks", async () => {
    const decks = [
      { key: "a", archetype: "Tokens" },
      { key: "b", archetype: "Voltron" },
    ];
    loadDataset.mockImplementation(async (name: string) =>
      name === "PRECON_FINGERPRINTS"
        ? [
            ["a", unit(0)],
            ["b", unit(1)],
          ]
        : decks,
    );
    const data = await import("./reference-data");
    const available = vi.fn((all: typeof decks) => all.filter((d) => d.key === "b"));
    expect(data.analysisDatasetsLoaded()).toBe(false);
    await Promise.all([
      data.loadAnalysisDatasets(available as never),
      data.loadAnalysisDatasets(available as never),
    ]);
    expect(data.analysisDatasetsLoaded()).toBe(true);
    expect(loadDataset).toHaveBeenCalledTimes(2);
    expect(available).toHaveBeenCalledTimes(1);
    // Only "b" survived the filter, so even a deck shaped like "a" matches nothing but "b".
    const match = data.archetypeMatch({ nonlandCount: 10, themes: { aristocrats: 5 } });
    expect(match?.top.key).toBe("b");
  });

  it("refuses percentiles before the reference set is stored, then uses it", async () => {
    const data = await import("./reference-data");
    expect(() => data.axisPercentile("speed", 5)).toThrow(/not loaded/);
    data.setStaticReference({
      referenceScores: [
        [1, 1, 1, 1, 1],
        [9, 9, 9, 9, 9],
      ],
      referenceTiers: ["p", "c"],
      staplesBaseline: { keys: [], baselines: {} },
      manabaseBaseline: { byIdentity: {}, byCount: {} },
    });
    expect(data.axisPercentile("speed", 5)).toBe(50);
    expect(data.axisPercentile("bogus", 5)).toBeNull();
  });
});
