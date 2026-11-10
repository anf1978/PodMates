import { describe, expect, it } from "vitest";
import { createHarness, stableJson } from "./harness";

const engine = createHarness();

describe("embedded sample decks", () => {
  it("covers every current sample with unique snapshot names", () => {
    expect(engine.samples).toHaveLength(178);
    expect(new Set(engine.samples.map((sample) => sample.key)).size).toBe(engine.samples.length);
  });

  for (const sample of engine.samples) {
    it(sample.key, () => {
      const result = engine.analyzeSample(sample);
      expect(result.notFound).toEqual([]);
      for (const score of Object.values(result.axes)) {
        expect(Number.isFinite(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(10);
      }
      expect(stableJson(result)).toMatchSnapshot();
    });
  }
});
