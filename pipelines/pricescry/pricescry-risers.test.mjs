import { describe, expect, it } from "vitest";
import { simulateMarket } from "./pricescry-sim.mjs";
import {
  riserAnatomy,
  riserScreen,
  liveScreen,
  buildSamples,
  RISER_DEFAULTS,
} from "./pricescry-risers.mjs";

const SEEDS = [5, 15, 25, 35, 45];
const POCKETS = [
  { link: "tribal_enabler", scarce: true, bands: ["cheap", "mid"], p: 0.35, mult: 2.3 },
  { link: "commander_staple", scarce: true, p: 0.2, mult: 2.2 },
];
const STRONG = [
  { link: "tribal_enabler", scarce: true, bands: ["cheap", "mid"], p: 0.6, mult: 2.3 },
  { link: "commander_staple", scarce: true, p: 0.45, mult: 2.2 },
];
const GATE = RISER_DEFAULTS.pShow;
const TIMEOUT = 120_000;

const mk = (seed, extra = {}) =>
  simulateMarket({
    seed,
    nEvents: 300,
    priceScale: 25,
    pockets: POCKETS,
    spikeRate: 0.00012,
    ...extra,
  });
const mkStrong = (seed, extra = {}) => mk(seed, { pockets: STRONG, ...extra });

function runWorld(maker, opts, seeds = SEEDS) {
  let shown = 0;
  let doubled = 0;
  let predicted = 0;
  let considered = 0;
  let allDoubled = 0;
  for (const seed of seeds) {
    const { src, events } = maker(seed);
    for (const row of riserScreen(events, src, opts).rows) {
      considered++;
      if (row.doubled) allDoubled++;
      if (row.shown) {
        shown++;
        if (row.doubled) doubled++;
        predicted += row.P;
      }
    }
  }
  return {
    shown,
    doubled,
    considered,
    allDoubled,
    rate: shown ? doubled / shown : null,
    claim: shown ? predicted / shown : null,
    base: allDoubled / considered,
  };
}

describe("riser anatomy", () => {
  it(
    "finds concentrated planted doublings without hiding unexplained episodes",
    () => {
      let episodes = 0;
      let unexplained = 0;
      let pocketDoubled = 0;
      let pocketN = 0;
      let otherDoubled = 0;
      let otherN = 0;
      for (const seed of SEEDS) {
        const { src, events } = mk(seed);
        const anatomy = riserAnatomy(src, events);
        episodes += anatomy.episodes;
        unexplained += anatomy.byLinkType.none || 0;
        for (const sample of buildSamples(events, src, RISER_DEFAULTS)) {
          const inPocket = sample.linkType === "tribal_enabler" && sample.scarce && sample.pb <= 1;
          if (inPocket) {
            pocketN++;
            if (sample.doubled) pocketDoubled++;
          } else {
            otherN++;
            if (sample.doubled) otherDoubled++;
          }
        }
      }
      expect(pocketDoubled / pocketN).toBeGreaterThanOrEqual(4 * (otherDoubled / otherN));
      expect(unexplained).toBeGreaterThan(0);
      expect(unexplained).toBeLessThan(episodes);
    },
    TIMEOUT,
  );
});

describe("walk-forward riser screen", () => {
  it(
    "shows calibrated strong signals well above the baseline at the default gate",
    () => {
      const world = runWorld(mkStrong, {});
      expect(world.shown).toBeGreaterThanOrEqual(100);
      expect(world.rate).toBeGreaterThanOrEqual(GATE - 0.03);
      expect(world.rate).toBeGreaterThanOrEqual(3 * world.base);
      expect(Math.abs(world.claim - world.rate)).toBeLessThanOrEqual(0.08);
    },
    TIMEOUT,
  );

  it(
    "rarely shows modest signals, remains calibrated, and catches only part of all risers",
    () => {
      const world = runWorld(mk, {}, [5, 15, 25, 35, 45, 55, 65, 75]);
      expect(world.shown).toBeLessThan(0.01 * world.considered);
      if (world.shown > 0) {
        expect(world.rate).toBeGreaterThanOrEqual(3 * world.base);
        expect(Math.abs(world.claim - world.rate)).toBeLessThanOrEqual(0.1);
      }
      expect(world.doubled / world.allDoubled).toBeLessThan(0.6);
    },
    TIMEOUT,
  );

  it(
    "shows almost no modest signals at a strict 50% gate",
    () => {
      expect(runWorld(mk, { pShow: 0.5 }).shown).toBeLessThanOrEqual(2);
    },
    TIMEOUT,
  );

  it(
    "still shows real candidates with strong signals at a strict 50% gate",
    () => {
      const world = runWorld(mkStrong, { pShow: 0.5 });
      expect(world.shown).toBeGreaterThanOrEqual(5);
      expect(world.rate).toBeGreaterThanOrEqual(0.4);
    },
    TIMEOUT,
  );

  it(
    "stays almost empty when breakouts are random and unpredictable",
    () => {
      let shown = 0;
      for (const seed of SEEDS) {
        const { src, events } = mk(seed, { pockets: null, baselineBreakout: 0.06 });
        shown += riserScreen(events, src, {}).rows.filter((row) => row.shown).length;
      }
      expect(shown).toBeLessThanOrEqual(5);
    },
    TIMEOUT,
  );

  it(
    "withholds likely doublings that cannot earn 300 yen after Mercari costs",
    () => {
      let cheapShown = 0;
      let belowMinimum = 0;
      let cheapLikely = 0;
      let dearShown = 0;
      for (const seed of SEEDS.slice(0, 3)) {
        const cheap = mkStrong(seed, { priceScale: 1 });
        const dear = mkStrong(seed);
        for (const row of riserScreen(cheap.events, cheap.src, {}).rows) {
          if (row.shown) {
            cheapShown++;
            if (row.netYenIfDoubled < 300) belowMinimum++;
          }
          if (row.P >= GATE && row.netYenIfDoubled < 300) cheapLikely++;
        }
        dearShown += riserScreen(dear.events, dear.src, {}).rows.filter((row) => row.shown).length;
      }
      expect(belowMinimum).toBe(0);
      expect(cheapLikely).toBeGreaterThan(0);
      expect(cheapShown * 3).toBeLessThan(dearShown);
    },
    TIMEOUT,
  );
});

describe("live riser screen", () => {
  it(
    "shows strong candidates using completed history and never shows below the gate",
    () => {
      let shown = 0;
      let belowGate = 0;
      for (const seed of SEEDS) {
        const { src, events } = mkStrong(seed);
        const cutoff = 700;
        const past = events.filter((event) => event.day + 14 <= cutoff);
        const fresh = events.filter((event) => event.day > cutoff && event.day <= 800);
        const result = liveScreen(
          past,
          fresh.map((event) => ({ ...event, day: Math.min(event.day, cutoff + 1) })),
          { ...src, maxDay: cutoff },
          {},
        );
        if (result.rows.some((row) => row.shown && row.P < GATE)) belowGate++;
        shown += result.rows.filter((row) => row.shown).length;
      }
      expect(belowGate).toBe(0);
      expect(shown).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    "explains that nothing can be judged and shows nothing without history",
    () => {
      const { src, events } = mk(5);
      const result = liveScreen([], events.slice(0, 3), src, {});
      expect(result.rows).toHaveLength(0);
      expect(result.note).toMatch(/nothing can be judged/);
    },
    TIMEOUT,
  );
});
