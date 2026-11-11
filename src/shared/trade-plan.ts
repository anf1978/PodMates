// The PriceScry trade plan: buy limit, target, exit and stake. Used by the card page's planner
// (src/features/pricescry/plan.ts) and the study pipeline (pipelines/pricescry/pricescry-study.mjs).
// Node runs this file directly: erasable TypeScript only (see ./pricescry.ts).
//
// For ONE card, given how likely you think it is to reach a target, this works out what a disciplined trader would
// decide BEFORE buying, all in yen and all after Mercari costs:
//   - the most you should pay (the "buy limit"): above it, the odds no longer pay for the costs and the risk;
//   - the target price to list at, and a price at which to stop and review;
//   - whether buying now is worth it at today's price, and the chance you need for it to break even;
//   - how much of your money to put on it: a quarter of the Kelly amount, capped, so one miss cannot hurt.
// Two outcomes are modelled: it HITS (sells at refYen x hitMult) or it MISSES (ends missReturn from where you bought,
// e.g. -0.10 for ten percent down). Real outcomes are a spread, so treat this as a disciplined rule of thumb, not a
// forecast. refYen is the price BEFORE the news (default: priceYen); if the price has already risen when you buy
// (priceYen above refYen), less of the move is left for you, and the plan says so.

export interface PlanInput {
  priceYen: number;
  pHit: number;
  refYen?: number;
  hitMult?: number;
  missReturn?: number;
  margin?: number;
  stopPct?: number;
  days?: number;
  kellyFraction?: number;
  maxStakePct?: number;
  feePct?: number;
  shipYen?: number;
  packYen?: number;
  bankrollYen?: number | null;
}

export interface TradePlan {
  entryYen: number;
  targetYen: number;
  stopYen: number;
  days: number;
  netIfHitYen: number;
  netIfMissYen: number;
  hitPct: number;
  missPct: number;
  ev: number;
  evYen: number;
  breakEvenP: number | null;
  maxEntryYen: number | null;
  verdict: "buy" | "too_high" | "pass";
  stakePct: number;
  stakeYen: number | null;
  cards: number | null;
}

export function planTrade(o: PlanInput): TradePlan {
  const p = {
    refYen: o.priceYen,
    hitMult: 2,
    missReturn: -0.1,
    margin: 0.1,
    stopPct: 0.3,
    days: 14,
    kellyFraction: 0.25,
    maxStakePct: 0.05,
    feePct: 10,
    shipYen: 230,
    packYen: 30,
    bankrollYen: null as number | null,
    ...o,
  };
  const E = p.priceYen,
    T = p.refYen * p.hitMult;
  // What lands in your hands from one sale, and profit as a share of what you paid.
  const netYen = (sale: number): number =>
    sale - Math.floor((sale * p.feePct) / 100) - p.shipYen - p.packYen;
  const fr = (entry: number, sale: number): number => (netYen(sale) - entry) / entry;
  const hitF = fr(E, T),
    missF = fr(E, E * (1 + p.missReturn));
  const ev = (entry: number): number =>
    p.pHit * fr(entry, T) + (1 - p.pHit) * fr(entry, entry * (1 + p.missReturn));
  // The highest price at which the expected return still clears the margin.
  let maxEntryYen: number | null = null;
  for (let k = 0; k <= 600; k++) {
    const entry = T * Math.pow(0.995, k);
    if (entry < 1) break;
    if (ev(entry) >= p.margin) {
      maxEntryYen = Math.floor(entry / 10) * 10;
      break;
    }
  }
  const breakEvenP = hitF > missF ? Math.min(1, Math.max(0, -missF / (hitF - missF))) : null;
  const evNow = ev(E);
  const verdict: TradePlan["verdict"] =
    evNow >= p.margin ? "buy" : maxEntryYen !== null && E > maxEntryYen ? "too_high" : "pass";
  let stakePct = 0;
  // No stake unless the plan says buy: a thin or negative edge gets nothing. Kelly: share of money to risk.
  if (verdict === "buy" && hitF > 0) {
    const l = Math.max(0, -missF),
      f = l > 0 ? p.pHit / l - (1 - p.pHit) / hitF : Infinity;
    stakePct = f > 0 ? Math.min(p.maxStakePct, p.kellyFraction * f) : 0;
  }
  const stakeYen = p.bankrollYen ? Math.floor(p.bankrollYen * stakePct) : null;
  return {
    entryYen: E,
    targetYen: Math.round(T),
    stopYen: Math.round(E * (1 - p.stopPct)),
    days: p.days,
    netIfHitYen: Math.round(netYen(T) - E),
    netIfMissYen: Math.round(netYen(E * (1 + p.missReturn)) - E),
    hitPct: hitF,
    missPct: missF,
    ev: evNow,
    evYen: Math.round(evNow * E),
    breakEvenP,
    maxEntryYen,
    verdict,
    stakePct,
    stakeYen,
    cards: stakeYen != null ? Math.floor(stakeYen / E) : null,
  };
}
