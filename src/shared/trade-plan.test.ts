// Fixed vectors taken from planTrade before the page and pipeline copies were merged.
import { describe, expect, it } from "vitest";
import { planTrade, type PlanInput, type TradePlan } from "./trade-plan";

const CASES: [PlanInput, TradePlan][] = [
  [
    { priceYen: 1000, refYen: 1000, pHit: 0.33 },
    {
      entryYen: 1000,
      targetYen: 2000,
      stopYen: 700,
      days: 14,
      netIfHitYen: 540,
      netIfMissYen: -450,
      hitPct: 0.54,
      missPct: -0.45,
      ev: -0.12329999999999997,
      evYen: -123,
      breakEvenP: 0.4545454545454546,
      maxEntryYen: 590,
      verdict: "too_high",
      stakePct: 0,
      stakeYen: null,
      cards: null,
    },
  ],
  [
    { priceYen: 1000, refYen: 1000, pHit: 0.6, bankrollYen: 200_000 },
    {
      entryYen: 1000,
      targetYen: 2000,
      stopYen: 700,
      days: 14,
      netIfHitYen: 540,
      netIfMissYen: -450,
      hitPct: 0.54,
      missPct: -0.45,
      ev: 0.144,
      evYen: 144,
      breakEvenP: 0.4545454545454546,
      maxEntryYen: 1050,
      verdict: "buy",
      stakePct: 0.05,
      stakeYen: 10000,
      cards: 10,
    },
  ],
  [
    { priceYen: 1800, refYen: 1000, pHit: 0.4, hitMult: 2.5, missReturn: -0.2 },
    {
      entryYen: 1800,
      targetYen: 2500,
      stopYen: 1260,
      days: 14,
      netIfHitYen: 190,
      netIfMissYen: -764,
      hitPct: 0.10555555555555556,
      missPct: -0.42444444444444446,
      ev: -0.21244444444444444,
      evYen: -382,
      breakEvenP: 0.80083857442348,
      maxEntryYen: 950,
      verdict: "too_high",
      stakePct: 0,
      stakeYen: null,
      cards: null,
    },
  ],
  [
    { priceYen: 300, refYen: 250, pHit: 0.05 },
    {
      entryYen: 300,
      targetYen: 500,
      stopYen: 210,
      days: 14,
      netIfHitYen: -110,
      netIfMissYen: -317,
      hitPct: -0.36666666666666664,
      missPct: -1.0566666666666666,
      ev: -1.0221666666666667,
      evYen: -307,
      breakEvenP: 1,
      maxEntryYen: null,
      verdict: "pass",
      stakePct: 0,
      stakeYen: null,
      cards: null,
    },
  ],
  [
    { priceYen: 5000, refYen: 5000, pHit: 1, hitMult: 1.1, missReturn: 0.5, bankrollYen: 10_000 },
    {
      entryYen: 5000,
      targetYen: 5500,
      stopYen: 3500,
      days: 14,
      netIfHitYen: -310,
      netIfMissYen: 1490,
      hitPct: -0.062,
      missPct: 0.298,
      ev: -0.062,
      evYen: -310,
      breakEvenP: null,
      maxEntryYen: 4250,
      verdict: "too_high",
      stakePct: 0,
      stakeYen: 0,
      cards: 0,
    },
  ],
  // refYen defaults to the current price (the study pipeline relies on this).
  [
    { priceYen: 800, pHit: 0.5 },
    {
      entryYen: 800,
      targetYen: 1600,
      stopYen: 560,
      days: 14,
      netIfHitYen: 380,
      netIfMissYen: -412,
      hitPct: 0.475,
      missPct: -0.515,
      ev: -0.020000000000000018,
      evYen: -16,
      breakEvenP: 0.5202020202020202,
      maxEntryYen: 660,
      verdict: "too_high",
      stakePct: 0,
      stakeYen: null,
      cards: null,
    },
  ],
];

describe("planTrade", () => {
  it.each(CASES)("plans %j", (input, expected) => {
    expect(planTrade(input)).toEqual(expected);
  });
  it("only stakes money on a buy verdict", () => {
    expect(planTrade(CASES[3]![0])).toMatchObject({ verdict: "pass", stakePct: 0 });
    expect(planTrade(CASES[1]![0]).verdict).toBe("buy");
    expect(planTrade(CASES[1]![0]).stakeYen).toBeGreaterThan(0);
  });
});
