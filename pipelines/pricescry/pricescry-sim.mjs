// A synthetic card market with KNOWN effects planted in it, used to prove the study engine
// can find real patterns and does not invent patterns in noise.
//
// Each card follows a random walk with a market-wide factor, fat-tailed noise, and higher
// volatility for cheap cards. Events then push linked cards' prices by a chosen amount,
// ramping up over a few days and fading a little afterwards. Some link types have no effect
// at all (as with weak links or fake leaks), and a "noise only" market has none anywhere.

import { rngFrom } from './pricescry-study.mjs';

export const PLANTED = {
  tribal_enabler:  { mean: 0.30, sd: 0.12, event: 'spoiler' },
  commander_staple:{ mean: 0.20, sd: 0.10, event: 'spoiler' },
  reprint:         { mean: -0.18, sd: 0.08, event: 'reprint_announced' },
  weak_link:       { mean: 0.00, sd: 0.00, event: 'spoiler' },
  fake_leak:       { mean: 0.00, sd: 0.00, event: 'spoiler' },
};
const PROFILE = [0.45, 0.70, 0.85, 1, 1, 1, 1];
const BREAK_PROFILE = [0.35, 0.65, 0.85, 1, 1, 1, 1];     // share of the full effect reached on day 0,1,2,3...
const BAND_MULT = { cheap: 1.4, mid: 1.0, high: 0.5 };   // cheap cards react more

export function simulateMarket({ seed = 1, nCards = 700, nDays = 900, nEvents = 90, effects = PLANTED, linksPerEvent = [8, 14], noiseMult = 1, priceScale = 1, pockets = null, baselineBreakout = 0.01, spikeRate = 0 } = {}) {
  const rng = rngFrom(seed);
  const rng2 = rngFrom((seed ^ 0x9e3779b9) >>> 0);   // separate stream for the extras below
  const normal = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
  const fatTail = () => normal() / Math.sqrt((Math.abs(normal() * normal()) + 0.5) / 1.0 + 0.0001) * 0.75;   // occasional big days
  const keys = Array.from({ length: nCards }, (_, i) => `card ${i}`);
  const base = keys.map(() => priceScale * (Math.exp(Math.log(1.5) + normal() * 1.1) + 0.2));
  const er = keys.map((_, i) => (rng() < 0.2 ? null : 1 + Math.floor(rng() * 25000)));
  const beta = keys.map(() => 0.6 + rng() * 0.8);
  const market = Array.from({ length: nDays }, () => normal() * 0.008);
  const rs = keys.map(() => (rng2() < 0.06 ? 1 : 0));
  const printings = keys.map((_, i) => (rs[i] ? 1 : 1 + Math.floor(rng2() * rng2() * 8)));
  // price bands by starting price rank
  const order = base.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const band = new Array(nCards); order.forEach(([, i], r) => { band[i] = r < nCards * 0.3 ? 'cheap' : r < nCards * 0.7 ? 'mid' : 'high'; });
  // events
  const types = Object.keys(effects);
  const events = []; const used = [];
  const spacing = Math.max(1, Math.min(4, Math.floor((nDays - 80) / (nEvents * 1.5))));   // events are kept a few days apart where the timeline allows
  let attempts = 0;
  while (events.length < nEvents) {
    if (++attempts > nEvents * 200) throw new Error('simulateMarket: timeline too short for that many events');
    const day = 40 + Math.floor(rng() * (nDays - 80));
    if (used.some(d => Math.abs(d - day) < spacing)) continue; used.push(day);
    const type = types[Math.floor(rng() * types.length)];
    const nl = linksPerEvent[0] + Math.floor(rng() * (linksPerEvent[1] - linksPerEvent[0] + 1));
    const links = []; const seen = new Set();
    while (links.length < nl) { const i = Math.floor(rng() * nCards); if (seen.has(i)) continue; seen.add(i); links.push({ card: keys[i], type }); }
    events.push({ id: `e${events.length}`, type: effects[type].event, day, links });
  }
  // build prices
  const prices = keys.map((_, i) => {
    const sigma = noiseMult * (band[i] === 'cheap' ? 0.03 : band[i] === 'mid' ? 0.02 : 0.013);
    const lp = new Float64Array(nDays); let level = Math.log(base[i]);
    for (let t = 0; t < nDays; t++) { level += beta[i] * market[t] + sigma * fatTail(); lp[t] = level; }
    return lp;
  });
  const truth = [];
  for (const ev of events) for (const l of ev.links) {
    const i = keys.indexOf(l.card), spec = effects[l.type];
    const eff = (spec.mean + normal() * spec.sd) * BAND_MULT[band[i]];
    truth.push({ event: ev.id, card: l.card, type: l.type, band: band[i], effect: eff });
    // rare breakouts: some kinds of link, on some kinds of card, sometimes more than double the price
    if (pockets) {
      const scarce = rs[i] === 1 || printings[i] <= 2;
      const hit = pockets.find(pk => pk.link === l.type && (!pk.scarce || scarce) && (!pk.bands || pk.bands.includes(band[i])));
      const pb = hit ? hit.p : baselineBreakout;
      if (rng2() < pb) {
        const bm = (hit ? hit.mult : 2.2) * (0.9 + rng2() * 0.3), lg2 = Math.log(bm);
        truth.push({ event: ev.id, card: l.card, type: l.type, band: band[i], breakout: true, mult: bm });
        for (let t = ev.day; t < nDays; t++) { const k = t - ev.day; const pr = k < BREAK_PROFILE.length ? BREAK_PROFILE[k] : (k < 25 ? 1 : 0.85); prices[i][t] += lg2 * pr; }
      }
    }
    if (eff === 0) continue;
    const lg = Math.log(Math.max(0.05, 1 + eff));
    for (let t = ev.day; t < nDays; t++) {
      const k = t - ev.day, prof = k < PROFILE.length ? PROFILE[k] : (k < 30 ? 1 - 0.2 * ((k - 6) / 24) : 0.8);
      prices[i][t] += lg * prof;
    }
  }
  if (spikeRate > 0) {
    for (let i = 0; i < nCards; i++) for (let t0 = 20; t0 < nDays - 40; t0++) {
      if (rng2() >= spikeRate) continue;
      const lg = Math.log(2 + rng2() * 1.2);
      for (let t = t0; t < nDays; t++) { const k = t - t0; const pr = k < 2 ? 0.5 + 0.25 * k : k < 10 ? 1 : k < 30 ? 1 - (k - 10) / 20 : 0; if (pr === 0 && k >= 30) break; prices[i][t] += lg * pr; }
    }
  }
  const px = prices.map(lp => Float64Array.from(lp, v => Math.max(0.05 * priceScale, Math.exp(v))));
  const src = { n: nCards, keys, index: new Map(keys.map((k, i) => [k, i])), er, rs, printings, minDay: 0, maxDay: nDays - 1, price: (i, d) => (d >= 0 && d < nDays ? px[i][d] : undefined) };
  return { src, events, truth, band };
}
