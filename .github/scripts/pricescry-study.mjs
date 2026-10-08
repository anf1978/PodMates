// PriceScry study engine: learns from past events how prices moved, and tests whether
// that knowledge would have worked on events it had not yet seen.
//
// THE IDEA (an "event study")
//   An EVENT is something that may move prices (a spoiler, a leak, a reprint announcement, a
//   ban). Each event has LINKS: existing cards it might affect, tagged with a link type
//   ("tribal_enabler", "reprint", ...). For every link we measure how the card's price
//   changed over the next few days, MINUS how comparable cards (similar price and
//   popularity, not linked to this event) changed over the same days. That difference is the
//   "abnormal return": it removes market-wide drift and general release-season swings.
//
//   Then three safeguards decide whether a pattern is believable:
//     1. Placebo test: give the same links random dates; real effects must stand out from
//        what chance produces. Many groups are tested, so the false-discovery rate is
//        controlled (Benjamini-Hochberg).
//     2. Walk-forward test: for each event in time order, fit only on events that had fully
//        played out BEFORE it, pick cards, and see what would have happened. No peeking.
//     3. Cost test: a pick only counts if its expected move beats the round-trip cost.
//
// PRICE SOURCE
//   Everything reads prices through a small interface, so the same engine runs on the real
//   history files or on the synthetic market in pricescry-sim.mjs:
//     { n, keys[], index: Map(key -> i), er[] (popularity rank or null), minDay, maxDay,
//       price(i, day) -> number | undefined }
//   Days are whole days since 2020-01-01 (see pricescry-lib.mjs).
//
// Usage on real data (once events exist):
//   node pricescry-study.mjs <data-dir> <events.json> [report.json]

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join } from 'path';
import { dayIndex, marketCentsAt, makeEurUsd } from './pricescry-lib.mjs';

export const DEFAULTS = {
  horizons: [1, 3, 7, 14],     // days after the event to measure
  hStar: 3,                    // the horizon used for picks and the trade test
  cost: 0.20,                  // round-trip cost as a fraction (spread + fees + shipping); SET THIS FROM YOUR REAL COSTS
  T: 0.20,                     // what counts as a "big" rise
  topK: 5, pMin: 0.35, margin: 0.05,
  minTrainEvents: 25, minN: 15, shrinkK: 10,
  placeboReps: 100, bootReps: 300, fdr: 0.10,
};

export function rngFrom(seed) {   // small seeded random generator (mulberry32), so tests are repeatable
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- what a flip really costs in Japan ------------------------------------------------
// Selling on Mercari: the fee is a share of the SALE price, but shipping and packing are a fixed
// amount per card. So cheap cards are punished: shipping a 1,000-yen card by tracked parcel costs
// nearly a quarter of its value, while on a 10,000-yen card it is barely noticeable.
//
// Defaults (check them against your own sales; they are the part most likely to be off):
//   sellFeePct   0.10   Mercari takes 10% of the sale price (Yahoo Auctions is also 10% since June 2024;
//                       Yahoo Flea Market was 5% when last checked in 2024).
//   shipYen      230    Mercari's own tracked parcel rate for one card (Yu-Yu Mercari Bin is 230 yen, Nekopos 210).
//                       Chosen over cheaper plain Japan Post mail (about 70 yen) on purpose: plain mail has no
//                       tracking and no loss cover, so one lost card can wipe out several profitable ones.
//                       Change it if you decide differently.
//   packYen      30     sleeve, toploader, envelope (an assumption).
//   buyFixedYen  0      shipping on the buy side; 0 assumes you buy several cards per order.
//   resaleVsBuy  1.0    the price you can really sell at, as a share of the price you paid (before the
//                       rise). 1.0 is OPTIMISTIC: shops include their margin, so this needs measuring
//                       from real Mercari sold prices. Lower it if you find a gap.
//   trackedAboveYen null  OPTIONAL: only matters if you set shipYen to a cheap untracked rate. Then, anything that
//                       sells above this price is costed at trackedShipYen (default 230) instead.
//   usdToJpy     150    only used because the price history is in dollars.
export function japanCostModel(o = {}) {
  const p = { sellFeePct: 0.10, shipYen: 230, packYen: 30, buyFixedYen: 0, resaleVsBuy: 1.0, trackedAboveYen: null, trackedShipYen: 230, usdToJpy: 150, ...o };
  const shipFor = (saleYen) => (p.trackedAboveYen != null && saleYen > p.trackedAboveYen ? p.trackedShipYen : p.shipYen);
  return {
    params: p,
    // Return after all costs for a card bought at p0Usd that then moves by `ret` (0.25 = +25%).
    netReturn(ret, p0Usd) {
      const P = p0Usd * p.usdToJpy;
      const sale = (1 + ret) * p.resaleVsBuy * P;
      return (sale * (1 - p.sellFeePct) - shipFor(sale) - p.packYen - P - p.buyFixedYen) / P;
    },
    // How much the price must RISE just to get your money back.
    breakEven(p0Usd) {
      const P = p0Usd * p.usdToJpy;
      const solve = (ship) => (P + ship + p.packYen + p.buyFixedYen) / ((1 - p.sellFeePct) * p.resaleVsBuy * P) - 1;
      const plain = solve(p.shipYen);
      if (p.trackedAboveYen == null || (1 + plain) * p.resaleVsBuy * P <= p.trackedAboveYen) return plain;
      return solve(p.trackedShipYen);
    },
    breakEvenYen(priceYen) { return this.breakEven(priceYen / p.usdToJpy); },
  };
}

// ---- the trade plan: buy limit, target, exit and stake ------------------------------------------------
// For ONE card, given how likely you think it is to reach a target, this works out what a disciplined trader would decide
// BEFORE buying, all in yen and all after Mercari costs:
//   - the most you should pay (the "buy limit"): above it, the odds no longer pay for the costs and the risk;
//   - the target price to list at, and a price at which to stop and review;
//   - whether buying now is worth it at today's price, and the chance you need for it to break even;
//   - how much of your money to put on it: a quarter of the Kelly amount, capped, so one miss cannot hurt.
// Two outcomes are modelled: it HITS (sells at refYen x hitMult) or it MISSES (ends missReturn from where you bought,
// e.g. -0.10 for ten percent down). Real outcomes are a spread, so treat this as a disciplined rule of thumb, not a forecast.
// refYen is the price BEFORE the news; if the price has already risen when you buy (priceYen above refYen), less of the
// move is left for you, and the plan says so.
// KEEP IN SYNC: psPlanTrade in index.html is a copy of this function; a test compares the two.
export function planTrade(o) {
  const p = { refYen: o.priceYen, hitMult: 2, missReturn: -0.10, margin: 0.10, stopPct: 0.30, days: 14, kellyFraction: 0.25, maxStakePct: 0.05, feePct: 10, shipYen: 230, packYen: 30, bankrollYen: null, ...o };
  const E = p.priceYen, T = p.refYen * p.hitMult;
  const netYen = (sale) => sale - Math.floor((sale * p.feePct) / 100) - p.shipYen - p.packYen;     // what lands in your hands from one sale
  const fr = (entry, sale) => (netYen(sale) - entry) / entry;                                       // profit as a share of what you paid
  const hitF = fr(E, T), missF = fr(E, E * (1 + p.missReturn));
  const ev = (entry) => p.pHit * fr(entry, T) + (1 - p.pHit) * fr(entry, entry * (1 + p.missReturn));
  let maxEntryYen = null;                                  // the highest price at which the expected return still clears the margin
  for (let k = 0; k <= 600; k++) { const entry = T * Math.pow(0.995, k); if (entry < 1) break; if (ev(entry) >= p.margin) { maxEntryYen = Math.floor(entry / 10) * 10; break; } }
  const breakEvenP = hitF > missF ? Math.min(1, Math.max(0, -missF / (hitF - missF))) : null;
  const evNow = ev(E);
  const verdict = evNow >= p.margin ? 'buy' : (maxEntryYen !== null && E > maxEntryYen ? 'too_high' : 'pass');
  let stakePct = 0;
  if (verdict === 'buy' && hitF > 0) {            // no stake unless the plan says buy: a thin or negative edge gets nothing
    const l = Math.max(0, -missF), f = l > 0 ? p.pHit / l - (1 - p.pHit) / hitF : Infinity;       // Kelly: share of money to risk
    stakePct = f > 0 ? Math.min(p.maxStakePct, p.kellyFraction * f) : 0;
  }
  const stakeYen = p.bankrollYen ? Math.floor(p.bankrollYen * stakePct) : null;
  return { entryYen: E, targetYen: Math.round(T), stopYen: Math.round(E * (1 - p.stopPct)), days: p.days, netIfHitYen: Math.round(netYen(T) - E), netIfMissYen: Math.round(netYen(E * (1 + p.missReturn)) - E),
    hitPct: hitF, missPct: missF, ev: evNow, evYen: Math.round(evNow * E), breakEvenP, maxEntryYen, verdict, stakePct, stakeYen, cards: stakeYen != null ? Math.floor(stakeYen / E) : null };
}

// ---- observations ------------------------------------------------------------------
const popBucket = (er) => (er == null ? 3 : er <= 2000 ? 0 : er <= 10000 ? 1 : 2);
const bandName = (decile) => (decile < 3 ? 'cheap' : decile < 7 ? 'mid' : 'high');

export function computeObservations(events, src, horizons) {
  const out = [];
  for (const ev of events) {
    const d0 = ev.day - 1;                       // last price BEFORE the event day
    const linked = new Map();
    for (const l of ev.links) { const i = src.index.get(l.card); if (i !== undefined) linked.set(i, l); }
    for (const h of horizons) {
      const dH = d0 + h;
      if (dH > src.maxDay || d0 < src.minDay) continue;
      const rows = [];
      for (let i = 0; i < src.n; i++) {
        const p0 = src.price(i, d0), pH = src.price(i, dH);
        if (p0 === undefined || pH === undefined || p0 <= 0) continue;
        rows.push([i, p0, Math.max(-0.9, Math.min(5, pH / p0 - 1))]);
      }
      if (rows.length < 50) continue;
      const sortedP = rows.map(r => r[1]).sort((a, b) => a - b);
      const decile = (p) => { let lo = 0, hi = sortedP.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sortedP[m] < p) lo = m + 1; else hi = m; } return Math.min(9, Math.floor((lo / sortedP.length) * 10)); };
      const sums = new Float64Array(40), cnt = new Float64Array(40);
      let allSum = 0, allCnt = 0; const info = new Map();
      for (const [i, p0, ret] of rows) {
        const dec = decile(p0), b = dec * 4 + popBucket(src.er[i]);
        info.set(i, { b, dec, p0, ret });
        if (!linked.has(i)) { sums[b] += ret; cnt[b]++; allSum += ret; allCnt++; }
      }
      for (const [i, l] of linked) {
        const r = info.get(i); if (!r) continue;
        const ctrl = cnt[r.b] >= 8 ? sums[r.b] / cnt[r.b] : allSum / allCnt;   // comparable cards' average move
        out.push({ eventId: ev.id, eventType: ev.type, linkType: l.type, card: i, day: ev.day, h, p0: r.p0, ret: r.ret, abn: r.ret - ctrl, band: bandName(r.dec) });
      }
    }
  }
  return out;
}

export const groupKey = (o, by) => (by === 'link' ? o.linkType : `${o.linkType}|${o.band}`);

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ---- effect table ---------------------------------------------------------------
export function summarize(obs, by, opts = {}) {
  const { bootReps = 0, rng = Math.random } = opts;
  const groups = new Map();
  for (const o of obs) { const k = groupKey(o, by) + '@' + o.h; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); }
  const rows = [];
  for (const [k, list] of groups) {
    const [group, h] = k.split('@');
    const abn = list.map(o => o.abn), ret = list.map(o => o.ret);
    const events = [...new Set(list.map(o => o.eventId))];
    const row = { group, h: Number(h), n: list.length, nEvents: events.length, meanAbn: mean(abn), medianAbn: median(abn), meanRet: mean(ret), shareBig: ret.filter(r => r >= (opts.T ?? DEFAULTS.T)).length / ret.length };
    if (bootReps > 0 && events.length >= 3) {          // cluster bootstrap: resample whole events, because cards in one event share its shock
      const byEv = new Map(); for (const o of list) { if (!byEv.has(o.eventId)) byEv.set(o.eventId, []); byEv.get(o.eventId).push(o.abn); }
      const evs = [...byEv.values()], means = [];
      for (let b = 0; b < bootReps; b++) { let s = 0, c = 0; for (let j = 0; j < evs.length; j++) { const e = evs[Math.floor(rng() * evs.length)]; for (const v of e) { s += v; c++; } } means.push(s / c); }
      means.sort((a, b) => a - b); row.ciLo = means[Math.floor(bootReps * 0.025)]; row.ciHi = means[Math.floor(bootReps * 0.975)];
    }
    rows.push(row);
  }
  return rows;
}

// Same links, random dates. If an effect is real it should beat what chance produces.
export function placebo(events, src, opts) {
  const { horizons, placeboReps, by, rng } = opts;
  const maxH = Math.max(...horizons);
  const lo = src.minDay + 2, hi = src.maxDay - maxH - 1;
  const nullMeans = new Map();
  for (let r = 0; r < placeboReps; r++) {
    const fake = events.map(e => ({ ...e, day: lo + Math.floor(rng() * (hi - lo + 1)) }));
    const rows = summarize(computeObservations(fake, src, horizons), by);
    for (const row of rows) { const k = row.group + '@' + row.h; if (!nullMeans.has(k)) nullMeans.set(k, []); nullMeans.get(k).push(row.meanAbn); }
  }
  return nullMeans;
}

export function benjaminiHochberg(pvals, q) {            // which p-values survive a false-discovery rate of q
  const idx = pvals.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  let cutoff = -1;
  idx.forEach(([p], rank) => { if (p <= ((rank + 1) / pvals.length) * q) cutoff = rank; });
  const keep = new Array(pvals.length).fill(false);
  for (let r = 0; r <= cutoff; r++) keep[idx[r][1]] = true;
  return keep;
}

export function effectTable(events, src, userOpts = {}) {
  const o = { ...DEFAULTS, by: 'link+band', rng: rngFrom(7), ...userOpts };
  const obs = computeObservations(events, src, o.horizons);
  const rows = summarize(obs, o.by, { bootReps: o.bootReps, rng: o.rng, T: o.T });
  const nulls = placebo(events, src, o);
  for (const r of rows) {
    const nm = nulls.get(r.group + '@' + r.h) || [];
    const extreme = nm.filter(v => Math.abs(v) >= Math.abs(r.meanAbn)).length;
    r.p = (1 + extreme) / (nm.length + 1);
  }
  const testable = rows.filter(r => r.nEvents >= 5);
  const keep = benjaminiHochberg(testable.map(r => r.p), o.fdr);
  testable.forEach((r, i) => { r.significant = keep[i]; });
  rows.forEach(r => { if (r.significant === undefined) r.significant = false; });
  rows.sort((a, b) => a.p - b.p);
  return { rows, obs };
}

// ---- walk-forward trade test ---------------------------------------------------
export function walkForward(events, src, userOpts = {}) {
  const o = { ...DEFAULTS, by: 'link+band', rng: rngFrom(11), ...userOpts };
  const maxH = Math.max(...o.horizons);
  const obs = computeObservations(events, src, [o.hStar]);
  const byEvent = new Map(); for (const x of obs) { if (!byEvent.has(x.eventId)) byEvent.set(x.eventId, []); byEvent.get(x.eventId).push(x); }
  const order = [...events].sort((a, b) => a.day - b.day);
  const perEvent = [], picksAll = [], calib = [];
  for (const test of order) {
    const testObs = byEvent.get(test.id); if (!testObs || !testObs.length) continue;
    const train = order.filter(e => e.day + maxH <= test.day);        // only events whose outcome was fully known
    if (train.length < o.minTrainEvents) continue;
    const trainObs = train.flatMap(e => byEvent.get(e.id) || []);
    const stat = (by) => { const m = new Map(); for (const x of trainObs) { const k = groupKey(x, by); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
    const fine = stat(o.by), coarse = stat('link');
    const preds = [];
    for (const x of testObs) {
      let g = fine.get(groupKey(x, o.by)); if (!g || g.length < o.minN) g = coarse.get(x.linkType);
      if (!g || g.length < o.minN) continue;
      const expAbn = mean(g.map(v => v.abn)) * (g.length / (g.length + o.shrinkK));   // shrink toward zero when evidence is thin
      const pUp = (g.filter(v => v.ret >= o.T).length + 1) / (g.length + 2);
      preds.push({ x, expAbn, pUp });
    }
    const netOf = (ret, p0) => (o.costModel ? o.costModel.netReturn(ret, p0) : ret - o.cost);
    const net = (x) => netOf(x.ret, x.p0);
    for (const p of preds) calib.push({ pUp: p.pUp, hit: p.x.ret >= o.T ? 1 : 0 });
    const expNet = (p) => netOf(p.expAbn, p.x.p0);   // what the pick is expected to make after costs, at the price it would be bought
    const picks = preds.filter(p => expNet(p) >= o.margin && p.pUp >= o.pMin).sort((a, b) => expNet(b) - expNet(a)).slice(0, o.topK);
    const baseline = mean(testObs.map(net));
    const popular = [...testObs].filter(x => src.er[x.card] != null).sort((a, b) => src.er[a.card] - src.er[b.card]).slice(0, o.topK);
    if (picks.length) {
      perEvent.push({ id: test.id, day: test.day, model: mean(picks.map(p => net(p.x))), baseline, popular: popular.length ? mean(popular.map(net)) : baseline, n: picks.length });
      picksAll.push(...picks.map(p => net(p.x)));
    }
  }
  const diffs = perEvent.map(e => e.model - e.baseline);
  let ci = null;
  if (diffs.length >= 5) { const bs = []; for (let b = 0; b < 500; b++) { let s = 0; for (let j = 0; j < diffs.length; j++) s += diffs[Math.floor(o.rng() * diffs.length)]; bs.push(s / diffs.length); } bs.sort((a, b) => a - b); ci = [bs[12], bs[487]]; }
  const buckets = [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 1.01]].map(([lo, hi]) => { const c = calib.filter(x => x.pUp >= lo && x.pUp < hi); return { range: `${lo}-${Math.min(1, hi)}`, n: c.length, predicted: c.length ? mean(c.map(x => x.pUp)) : null, realized: c.length ? mean(c.map(x => x.hit)) : null }; });
  return {
    eventsTested: perEvent.length, picks: picksAll.length,
    meanNetPerPick: picksAll.length ? mean(picksAll) : null, hitRate: picksAll.length ? picksAll.filter(v => v > 0).length / picksAll.length : null,
    meanNetAllLinks: perEvent.length ? mean(perEvent.map(e => e.baseline)) : null,
    meanNetPopular: perEvent.length ? mean(perEvent.map(e => e.popular)) : null,
    edgeOverAllLinks: diffs.length ? mean(diffs) : null, edgeCI: ci, calibration: buckets,
  };
}

// ---- real data adapter + CLI -------------------------------------------------
export function shardSource(dataDir) {
  const recs = [];
  const dir = join(dataDir, 'cards');
  for (const f of readdirSync(dir)) { if (!f.endsWith('.json.gz')) continue; const sh = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString('utf8')); for (const [k, r] of Object.entries(sh.cards)) recs.push([k, r]); }
  const idx = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8'));
  const fxFile = join(dataDir, 'fx.json');
  const eurUsd = makeEurUsd(existsSync(fxFile) ? JSON.parse(readFileSync(fxFile, 'utf8')) : null);   // euros -> dollars, for Cardmarket
  const keys = recs.map(r => r[0]);
  return {
    n: recs.length, keys, index: new Map(keys.map((k, i) => [k, i])), er: recs.map(r => r[1].er ?? null),
    rs: recs.map(r => r[1].rs || 0), printings: recs.map(r => r[1].p.length),
    minDay: dayIndex(idx.firstDay), maxDay: dayIndex(idx.day),
    // the consensus price across shops (see pricescry-lib.mjs); older Scryfall-only data behaves as before
    price: (i, day) => { const v = marketCentsAt(recs[i][1], day, eurUsd); return v === undefined ? undefined : v / 100; },
  };
}
export function loadEvents(file) {                     // events.json: [{id,type,date,links:[{card,type}]}]
  return JSON.parse(readFileSync(file, 'utf8')).map(e => ({ ...e, day: e.day ?? dayIndex(e.date) }));
}
export function formatReport(table, wf) {
  const L = ['EFFECTS (abnormal return = move minus comparable cards; * = survives the placebo test)', 'group'.padEnd(34) + 'days   n  events   mean    median  95% range        p'];
  for (const r of table.rows.slice(0, 40)) L.push(`${r.group.padEnd(34)}${String(r.h).padStart(3)} ${String(r.n).padStart(4)} ${String(r.nEvents).padStart(5)}  ${(r.meanAbn * 100).toFixed(1).padStart(6)}% ${(r.medianAbn * 100).toFixed(1).padStart(6)}%  [${r.ciLo === undefined ? '  n/a' : (r.ciLo * 100).toFixed(1)}, ${r.ciHi === undefined ? 'n/a' : (r.ciHi * 100).toFixed(1)}]  ${r.p.toFixed(3)} ${r.significant ? '*' : ''}`);
  L.push('', 'WALK-FORWARD TRADE TEST (each pick fitted only on events that had fully played out before it)', JSON.stringify(wf, null, 1));
  return L.join('\n');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , dataDir, eventsFile, outFile] = process.argv;
  if (!dataDir || !eventsFile) { console.error('Usage: node pricescry-study.mjs <data-dir> <events.json> [report.json]'); process.exit(1); }
  const src = shardSource(dataDir), events = loadEvents(eventsFile);
  console.log(`Loaded ${src.n} cards, ${events.length} events, days ${src.minDay}..${src.maxDay}`);
  const idx = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8'));
  const costModel = japanCostModel({ usdToJpy: (idx.fx && idx.fx.usdjpy) || 150 });
  const table = effectTable(events, src), wf = walkForward(events, src, { costModel });
  console.log(formatReport(table, wf));
  console.log('\nBREAK-EVEN (how far a card must rise just to cover selling costs; your defaults, see japanCostModel):');
  for (const y of [500, 1000, 2000, 3000, 5000, 10000, 20000]) console.log(`  bought at ¥${String(y).padStart(6)}: needs +${(costModel.breakEvenYen(y) * 100).toFixed(1)}%`);
  if (outFile) writeFileSync(outFile, JSON.stringify({ table: table.rows, walkForward: wf }, null, 1));
}
