// The card-page planner is a copy of planTrade in pricescry-study.mjs (KEEP IN SYNC); it must give the same plan.
import { describe, expect, it } from "vitest";
import { planTrade as studyPlan } from "../../../pipelines/pricescry/pricescry-study.mjs";
import { planTrade, type PlanInput } from "./plan";

const CASES: PlanInput[] = [
  { priceYen: 1000, refYen: 1000, pHit: 0.33 },
  { priceYen: 1000, refYen: 1000, pHit: 0.6, bankrollYen: 200_000 },
  { priceYen: 1800, refYen: 1000, pHit: 0.4, hitMult: 2.5, missReturn: -0.2 },
  { priceYen: 300, refYen: 250, pHit: 0.05 },
  { priceYen: 5000, refYen: 5000, pHit: 1, hitMult: 1.1, missReturn: 0.5, bankrollYen: 10_000 },
];

describe("planTrade", () => {
  it.each(CASES)("matches pricescry-study.mjs for %j", (input) => {
    expect(planTrade(input)).toEqual(studyPlan(input));
  });
  it("only stakes money on a buy verdict", () => {
    expect(planTrade(CASES[3]!)).toMatchObject({ verdict: "pass", stakePct: 0 });
    expect(planTrade(CASES[1]!).verdict).toBe("buy");
    expect(planTrade(CASES[1]!).stakeYen).toBeGreaterThan(0);
  });
});
