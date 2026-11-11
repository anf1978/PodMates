import { describe, expect, it } from "vitest";
import { simulateMarket, PLANTED } from "./pricescry-sim.mjs";
import { effectTable, walkForward, japanCostModel } from "./pricescry-study.mjs";

const SEEDS = [11, 22, 33, 44, 55];
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const NOISE = Object.fromEntries(
  Object.entries(PLANTED).map(([key, value]) => [key, { ...value, mean: 0, sd: 0 }]),
);
const PLANTED_TYPES = ["tribal_enabler", "commander_staple", "reprint"];
const NULL_TYPES = ["weak_link", "fake_leak"];
const TIMEOUT = 180_000;
const WALK_FORWARD_OPTIONS = {
  hStar: 7,
  cost: 0.1,
  topK: 5,
  pMin: 0.35,
  margin: 0.05,
  minTrainEvents: 30,
};

describe("study effect estimates", () => {
  it(
    "finds planted effects with the right sign and size while rarely flagging null groups",
    () => {
      let found = 0;
      let plantedTotal = 0;
      let falseFlag = 0;
      let nullTotal = 0;
      const errors = [];
      for (const seed of SEEDS) {
        const { src, events, truth } = simulateMarket({ seed, nEvents: 110 });
        const { rows } = effectTable(events, src, {
          placeboReps: 100,
          bootReps: 0,
          horizons: [3, 7],
        });
        for (const row of rows.filter((row) => row.h === 7)) {
          const [type, band] = row.group.split("|");
          if (PLANTED_TYPES.includes(type)) {
            plantedTotal++;
            const trueMean = mean(
              truth
                .filter((entry) => entry.type === type && entry.band === band)
                .map((entry) => entry.effect),
            );
            if (row.significant && Math.sign(row.meanAbn) === Math.sign(trueMean)) found++;
            if (row.n >= 30) errors.push(Math.abs(row.meanAbn - trueMean));
          } else if (NULL_TYPES.includes(type)) {
            nullTotal++;
            if (row.significant) falseFlag++;
          }
        }
      }
      expect(found / plantedTotal).toBeGreaterThanOrEqual(0.85);
      expect(mean(errors)).toBeLessThanOrEqual(0.07);
      expect(falseFlag / nullTotal).toBeLessThanOrEqual(0.15);
    },
    TIMEOUT,
  );

  it(
    "does not invent patterns in markets with no planted effects",
    () => {
      let runsWithAny = 0;
      let flagged = 0;
      let tested = 0;
      for (const seed of SEEDS) {
        const { src, events } = simulateMarket({ seed: seed + 100, nEvents: 110, effects: NOISE });
        const { rows } = effectTable(events, src, {
          placeboReps: 100,
          bootReps: 0,
          horizons: [3, 7],
        });
        const testable = rows.filter((row) => row.nEvents >= 5);
        const significant = testable.filter((row) => row.significant).length;
        if (significant > 0) runsWithAny++;
        flagged += significant;
        tested += testable.length;
      }
      expect(flagged / tested).toBeLessThanOrEqual(0.08);
      expect(runsWithAny).toBeLessThanOrEqual(2);
    },
    TIMEOUT,
  );
});

describe("time-ordered trade recommendations", () => {
  it(
    "beats average linked cards with a significant edge and mostly profitable picks",
    () => {
      let edgeWins = 0;
      const hitRates = [];
      for (const seed of SEEDS) {
        const { src, events } = simulateMarket({ seed: seed + 200, nEvents: 200 });
        const result = walkForward(events, src, WALK_FORWARD_OPTIONS);
        if (result.hitRate != null) hitRates.push(result.hitRate);
        if (result.edgeCI && result.edgeCI[0] > 0) edgeWins++;
      }
      expect(edgeWins).toBeGreaterThanOrEqual(4);
      expect(mean(hitRates)).toBeGreaterThanOrEqual(0.6);
    },
    TIMEOUT,
  );

  it(
    "rarely reports a significant trading edge in noise-only markets",
    () => {
      let nullBeat = 0;
      for (const seed of SEEDS) {
        const { src, events } = simulateMarket({ seed: seed + 300, nEvents: 200, effects: NOISE });
        const result = walkForward(events, src, WALK_FORWARD_OPTIONS);
        if (result.edgeCI && result.edgeCI[0] > 0) nullBeat++;
      }
      expect(nullBeat).toBeLessThanOrEqual(1);
    },
    TIMEOUT,
  );

  it(
    "recommends no trades when 60% round-trip costs exceed the effects",
    () => {
      let picks = 0;
      for (const seed of SEEDS.slice(0, 3)) {
        const { src, events } = simulateMarket({ seed: seed + 200, nEvents: 200 });
        picks += walkForward(events, src, { ...WALK_FORWARD_OPTIONS, cost: 0.6 }).picks;
      }
      expect(picks).toBe(0);
    },
    TIMEOUT,
  );
});

describe("Japan selling costs", () => {
  it("charges fees on the sale price plus fixed shipping and packing", () => {
    const model = japanCostModel();
    const breakEven = model.breakEvenYen(1000);
    expect(Math.abs(breakEven - ((1000 + 260) / (0.9 * 1000) - 1))).toBeLessThan(1e-9);
    expect(Math.abs(breakEven - 0.4)).toBeLessThan(0.002);
  });

  it("lowers the break-even return as cards get dearer", () => {
    const model = japanCostModel();
    expect(model.breakEvenYen(2000)).toBeLessThan(model.breakEvenYen(1000));
    expect(model.breakEvenYen(10000)).toBeLessThan(model.breakEvenYen(2000));
    expect(Math.abs(model.breakEvenYen(2000) - 0.256)).toBeLessThan(0.002);
    expect(Math.abs(model.breakEvenYen(10000) - 0.14)).toBeLessThan(0.002);
  });

  it("earns exactly nothing when the price rises by its break-even return", () => {
    const model = japanCostModel();
    expect(
      Math.abs(model.netReturn(model.breakEvenYen(3000), 3000 / model.params.usdToJpy)),
    ).toBeLessThan(1e-9);
  });

  it("lowers the break-even bar for a cheaper 5% selling channel", () => {
    const cheaper = japanCostModel({ sellFeePct: 0.05 }).breakEvenYen(2000);
    expect(cheaper).toBeLessThan(japanCostModel().breakEvenYen(2000));
    expect(Math.abs(cheaper - ((2000 + 260) / (0.95 * 2000) - 1))).toBeLessThan(1e-9);
  });

  it("uses cheap untracked mail below the threshold and tracked shipping above it", () => {
    const model = japanCostModel({ shipYen: 70, trackedAboveYen: 3000 });
    expect(Math.abs(model.breakEvenYen(2000) - ((2000 + 100) / (0.9 * 2000) - 1))).toBeLessThan(
      1e-9,
    );
    expect(
      Math.abs(model.breakEvenYen(6000) - ((6000 + 230 + 30) / (0.9 * 6000) - 1)),
    ).toBeLessThan(1e-9);
  });

  it(
    "withholds cheap percentage movers but trades the same effects on dearer cards",
    () => {
      const model = japanCostModel({ usdToJpy: 150 });
      const run = (scale) => {
        let picks = 0;
        let wins = 0;
        for (const seed of SEEDS.slice(0, 3)) {
          const { src, events } = simulateMarket({
            seed: seed + 600,
            nEvents: 200,
            priceScale: scale,
          });
          const result = walkForward(events, src, {
            hStar: 7,
            topK: 5,
            pMin: 0.35,
            margin: 0.05,
            minTrainEvents: 30,
            costModel: model,
          });
          picks += result.picks;
          if (result.edgeCI && result.edgeCI[0] > 0) wins++;
        }
        return { picks, wins };
      };
      const cheap = run(1);
      const dear = run(25);
      expect(cheap.picks * 5).toBeLessThan(dear.picks);
      expect(dear.picks).toBeGreaterThanOrEqual(20);
      expect(dear.wins).toBeGreaterThanOrEqual(2);
    },
    TIMEOUT,
  );
});
