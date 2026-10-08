// PriceScry riser engine: which cards might DOUBLE, and is the evidence strong enough to show them?
//
// WHAT IT DOES
//   1. Anatomy of past risers: finds every time a card at least doubled (and stayed doubled for a few
//      days), then checks what preceded it. How many followed a spoiler, a reprint, a ban? How many
//      came out of nowhere? This is "what historical high-rushing cards looked like".
//   2. A probability model: for each card linked to a new event (a spoiler, say), it estimates the
//      chance of doubling within H days, from the kind of link, the card's price level, popularity,
//      scarcity (Reserved List, few printings) and recent momentum. It is a simple, regularised
//      logistic regression, so every number can be traced back to a reason.
//   3. A strict gate on what the screen may show. A card is shown ONLY if ALL of these hold:
//        - its estimated chance of doubling is at least pShow;
//        - there are at least minAnalogs similar past cases (same kind of link, scarcity and price
//          level) and their own record of doubling is not far below the claim (Wilson lower bound);
//        - even if it only just doubles, the profit after Mercari costs is at least minNetYen.
//      With no history, nothing passes the gate, so the screen stays empty rather than guessing.
//
// THE GATE IS A SETTING, AND IT MATTERS. It is set to one in three (pShow 0.33): a card is shown only if
// it has at least a 1-in-3 chance of doubling, which also means two in three of the cards shown will NOT
// double (though many of those still rise). A stricter bar such as 0.5 ("more likely than not") will
// usually show nothing, because big doublings are rare even in the best-looking situations. Where the
// real patterns are only moderate, a 1-in-3 gate will also show nothing until stronger evidence appears.
//
// Prices are read through the same interface as pricescry-study.mjs.

import { japanCostModel, planTrade } from './pricescry-study.mjs';

export const RISER_DEFAULTS = {
  H: 14,                 // days to double within
  mult: 2.0,             // "double"
  sustain: 3,            // must stay doubled this many days in a row, so a one-day thin-market spike does not count
  pShow: 0.33,           // minimum estimated chance of doubling to be shown: one in three (Anthony's choice)
  minAnalogs: 8,         // minimum similar past cases
  minNetYen: 300,        // minimum profit (yen, after Mercari costs) even if it only just doubles
  requireAnalogRate: false, // also demand that the coarse past-case group's own record reaches the gate (tested: it adds selection luck, so off)
  minCalibN: 30,
  margin: 0.10,          // the expected return after costs a pick must clear, on top of the chance-of-doubling gate
  maxEventStakePct: 0.10, // all picks from one event together are one bet (they move together), so their stakes share this cap
  bankrollYen: null,         // the screen must have at least this many CHECKED past predictions near this probability before trusting it
  retrainEvery: 15, minTrainEvents: 60, l2: 3.0, usdToJpy: 150,
};

// ---- outcomes -----------------------------------------------------------------
export function outcomeOf(src, i, d0, o) {
  const p0 = src.price(i, d0);
  if (p0 === undefined || p0 <= 0 || d0 + o.H > src.maxDay) return null;
  let peak = 1, run = 0, doubled = false;
  for (let t = d0 + 1; t <= d0 + o.H; t++) {
    const p = src.price(i, t); if (p === undefined) { run = 0; continue; }
    const r = p / p0; if (r > peak) peak = r;
    if (r >= o.mult) { run++; if (run >= o.sustain) doubled = true; } else run = 0;
  }
  return { doubled, peak };
}

// ---- anatomy of past risers -------------------------------------------------------
export function riserAnatomy(src, events, userOpts = {}) {
  const o = { ...RISER_DEFAULTS, ...userOpts };
  const linkByCard = new Map();           // card index -> [{day, type}]
  for (const ev of events) for (const l of ev.links) { const i = src.index.get(l.card); if (i === undefined) continue; if (!linkByCard.has(i)) linkByCard.set(i, []); linkByCard.get(i).push({ day: ev.day, type: l.type }); }
  const episodes = [];
  for (let i = 0; i < src.n; i++) {
    let d = src.minDay + 31;
    while (d <= src.maxDay - o.H) {
      const out = outcomeOf(src, i, d, o);
      if (out && out.doubled) {
        const near = (linkByCard.get(i) || []).filter(l => l.day >= d - 3 && l.day <= d + o.H);   // an event inside the window the card doubled in (or just before it)
        episodes.push({ card: i, day: d, peak: out.peak, linkType: near.length ? near[0].type : 'none' });
        d += o.H + 10;
      } else d += 1;
    }
  }
  const byType = {};
  for (const e of episodes) byType[e.linkType] = (byType[e.linkType] || 0) + 1;
  const peaks = episodes.map(e => e.peak).sort((a, b) => a - b);
  return {
    episodes: episodes.length, byLinkType: byType,
    unexplainedShare: episodes.length ? (byType.none || 0) / episodes.length : null,
    medianPeak: peaks.length ? peaks[peaks.length >> 1] : null,
  };
}

// ---- features ---------------------------------------------------------------------
const priceBucketYen = (usd, fx) => { const y = usd * fx; return y < 500 ? 0 : y < 1500 ? 1 : y < 5000 ? 2 : 3; };
const popBucket = (er) => (er == null ? 3 : er <= 2000 ? 0 : er <= 10000 ? 1 : 2);
const momBucket = (src, i, d0) => { const a = src.price(i, d0), b = src.price(i, d0 - 30); if (a === undefined || b === undefined || b <= 0) return 1; const g = Math.log(a / b); return g <= -0.10 ? 0 : g <= 0.10 ? 1 : g <= 0.30 ? 2 : 3; };
const scarceFlag = (src, i) => ((src.rs && src.rs[i] === 1) || (src.printings && src.printings[i] <= 2)) ? 1 : 0;
const printBucket = (src, i) => { const n = src.printings ? src.printings[i] : 3; return n <= 2 ? 0 : n <= 4 ? 1 : 2; };

// withOutcome=false describes a link whose outcome is not known yet (a brand-new event).
export function buildSamples(events, src, o, withOutcome = true) {
  const out = [];
  for (const ev of events) {
    const d0 = ev.day - 1;
    for (const l of ev.links) {
      const i = src.index.get(l.card); if (i === undefined) continue;
      const p0 = src.price(i, d0); if (p0 === undefined || p0 <= 0) continue;
      const res = withOutcome ? outcomeOf(src, i, d0, o) : { doubled: false, peak: 1 };
      if (!res) continue;
      const pEnd = withOutcome ? src.price(i, d0 + o.H) : undefined;
      out.push({ eventId: ev.id, day: ev.day, card: i, linkType: l.type, p0, endRet: pEnd !== undefined ? pEnd / p0 - 1 : 0, pb: priceBucketYen(p0, o.usdToJpy), pop: popBucket(src.er[i]), mom: momBucket(src, i, d0), scarce: scarceFlag(src, i), prt: printBucket(src, i), doubled: res.doubled, peak: res.peak });
    }
  }
  return out;
}

class Space {                                   // turns a sample into numbers
  constructor(samples) { this.links = [...new Set(samples.map(s => s.linkType))].sort(); this.dim = 1 + this.links.length + 4 + 4 + 4 + 1 + 3 + this.links.length + 1; }
  vec(s) {
    const x = new Float64Array(this.dim); let k = 0; x[k++] = 1;
    const li = this.links.indexOf(s.linkType);
    for (let j = 0; j < this.links.length; j++) x[k + j] = j === li ? 1 : 0; k += this.links.length;
    for (let j = 0; j < 4; j++) x[k + j] = s.pb === j ? 1 : 0; k += 4;
    for (let j = 0; j < 4; j++) x[k + j] = s.pop === j ? 1 : 0; k += 4;
    for (let j = 0; j < 4; j++) x[k + j] = s.mom === j ? 1 : 0; k += 4;
    x[k++] = s.scarce;
    for (let j = 0; j < 3; j++) x[k + j] = s.prt === j ? 1 : 0; k += 3;
    for (let j = 0; j < this.links.length; j++) x[k + j] = j === li && s.scarce ? 1 : 0; k += this.links.length;   // kind of link x scarce
    x[k++] = s.scarce && s.pb <= 1 ? 1 : 0;                                                                         // scarce and cheap
    return x;
  }
}

// ---- logistic regression (Newton / IRLS with a ridge penalty) ----------------------------
export function fitLogistic(X, y, l2) {
  const n = X.length, p = X[0].length; let w = new Float64Array(p);
  for (let it = 0; it < 12; it++) {
    const g = new Float64Array(p), H = Array.from({ length: p }, () => new Float64Array(p));
    for (let r = 0; r < n; r++) {
      let z = 0; for (let j = 0; j < p; j++) z += w[j] * X[r][j];
      const pr = 1 / (1 + Math.exp(-z)), err = y[r] - pr, wt = Math.max(pr * (1 - pr), 1e-6);
      for (let j = 0; j < p; j++) { const xj = X[r][j]; if (xj === 0) continue; g[j] += err * xj; for (let k = 0; k <= j; k++) { const xk = X[r][k]; if (xk !== 0) H[j][k] += wt * xj * xk; } }
    }
    for (let j = 0; j < p; j++) { for (let k = 0; k < j; k++) H[k][j] = H[j][k]; if (j > 0) { g[j] -= l2 * w[j]; H[j][j] += l2; } else H[j][j] += 1e-6; }
    const d = solve(H, g); let step = 0; for (let j = 0; j < p; j++) { w[j] += d[j]; step = Math.max(step, Math.abs(d[j])); }
    if (step < 1e-5) break;
  }
  return w;
}
function solve(A, b) {                           // Gaussian elimination with partial pivoting
  const n = b.length, M = A.map((r, i) => Float64Array.from([...r, b[i]]));
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c] || 1e-9;
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / d; if (f === 0) continue; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / (M[r][r] || 1e-9); }
  return x;
}
export const predictP = (w, x) => { let z = 0; for (let j = 0; j < w.length; j++) z += w[j] * x[j]; return 1 / (1 + Math.exp(-z)); };
export function wilsonLower(k, n, z = 1.64) {   // lower end of an ~90% range for a rate seen k times in n cases
  if (n === 0) return 0; const p = k / n, d = 1 + (z * z) / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
}

// A model that has just been fitted on past cases is always a little too sure of itself (it picked up some
// luck along with the pattern). So its raw probability is corrected using its OWN CHECKED TRACK RECORD:
// among earlier predictions of about this size, whose outcome is now known, how many really doubled?
// With few checked cases the raw number is trusted only a little; with none, nothing is shown at all.
const CAL_BINS = [0, 0.05, 0.15, 0.30, 0.50, 1.01];
export function calibrate(P, hist, prior = 15) {
  let b = 0; while (b < CAL_BINS.length - 2 && P >= CAL_BINS[b + 1]) b++;
  let n = 0, k = 0;
  for (const h of hist) if (h.P >= CAL_BINS[b] && h.P < CAL_BINS[b + 1]) { n++; if (h.doubled) k++; }
  return { Pcal: (k + prior * P) / (n + prior), calibN: n };
}

// Judges one link against what is known from past cases. Every condition must hold to be shown.
function judge(s, model, space, trainS, hist, o, cost, src) {
  const Praw = predictP(model, space.vec(s));
  const { Pcal: P, calibN } = calibrate(Praw, hist);
  const analog = trainS.filter(t => t.linkType === s.linkType && t.scarce === s.scarce && (t.pb <= 1) === (s.pb <= 1));
  const aN = analog.length, aK = analog.filter(t => t.doubled).length, aRate = aN ? aK / aN : 0;
  const netIfDoubled = cost.netReturn(o.mult - 1, s.p0), netYen = netIfDoubled * s.p0 * o.usdToJpy;
  // what past similar cards that did NOT double ended up doing (average move over the window), or -10% when there are too few to say
  const misses = analog.filter(t => !t.doubled).map(t => Math.max(-0.5, Math.min(0.5, t.endRet)));
  const missReturn = misses.length >= 8 ? misses.reduce((a, b) => a + b, 0) / misses.length : -0.10;
  const plan = planTrade({ priceYen: s.p0 * o.usdToJpy, pHit: P, hitMult: o.mult, missReturn, margin: o.margin, days: o.H, bankrollYen: o.bankrollYen, feePct: cost.params.sellFeePct * 100, shipYen: cost.params.shipYen, packYen: cost.params.packYen });
  const shown = P >= o.pShow && (!o.requireAnalogRate || aRate >= o.pShow) && aN >= o.minAnalogs && wilsonLower(aK, aN) >= o.pShow / 2 && netYen >= o.minNetYen && calibN >= o.minCalibN && plan.verdict === 'buy';
  const examples = analog.filter(t => t.doubled).sort((a, b) => b.day - a.day).slice(0, 3).map(t => ({ card: src.keys[t.card], day: t.day, peak: Math.round(t.peak * 100) / 100 }));
  return { P, Praw, calibN, analogN: aN, analogDoubled: aK, analogRate: aRate, netYenIfDoubled: netYen, shown, examples, missReturn, plan: shown ? plan : null };
}

// ---- the live screen: score the links of NEW events (outcome not known yet) -------------------
// Trains only on events whose full window has already played out by the latest priced day.
export function liveScreen(events, newEvents, src, userOpts = {}) {
  const o = { ...RISER_DEFAULTS, ...userOpts };
  const cost = o.costModel || japanCostModel({ usdToJpy: o.usdToJpy });
  const asOf = src.maxDay;
  const trainS = buildSamples(events.filter(e => e.day + o.H <= asOf), src, o);
  if (trainS.length < 100) return { rows: [], note: `Only ${trainS.length} past cases so far; nothing can be judged yet.`, trainSamples: trainS.length };
  const space = new Space(trainS), model = fitLogistic(trainS.map(s => space.vec(s)), trainS.map(s => (s.doubled ? 1 : 0)), o.l2);
  // the model's checked track record: replay the past, scoring each event with only what was known then
  const replay = riserScreen(events.filter(e => e.day + o.H <= asOf), src, { ...o, pShow: 2 }).rows;
  const hist = replay.map(r => ({ P: r.Praw, doubled: r.doubled }));
  const rows = buildSamples(newEvents, src, o, false).map(s => ({ eventId: s.eventId, day: s.day, card: s.card, name: src.keys[s.card], linkType: s.linkType, p0: s.p0, ...judge(s, model, space, trainS, hist, o, cost, src) }));
  // picks from one event move together, so together they are ONE bet: scale their stakes to share a single cap
  const byEvent = new Map();
  for (const r of rows.filter(r => r.shown)) { if (!byEvent.has(r.eventId)) byEvent.set(r.eventId, []); byEvent.get(r.eventId).push(r); }
  for (const list of byEvent.values()) {
    const total = list.reduce((a, r) => a + r.plan.stakePct, 0), scale = total > o.maxEventStakePct ? o.maxEventStakePct / total : 1;
    for (const r of list) { r.plan.stakePctCapped = r.plan.stakePct * scale; if (o.bankrollYen) { r.plan.stakeYenCapped = Math.floor(o.bankrollYen * r.plan.stakePctCapped); r.plan.cardsCapped = Math.floor(r.plan.stakeYenCapped / r.plan.entryYen); } }
  }
  return { rows, trainSamples: trainS.length, checkedPredictions: hist.length, asOf };
}

// ---- the screen: walk forward in time, show only what passes the gate ----------------------
export function riserScreen(events, src, userOpts = {}) {
  const o = { ...RISER_DEFAULTS, ...userOpts };
  const cost = o.costModel || japanCostModel({ usdToJpy: o.usdToJpy });
  const samples = buildSamples(events, src, o);
  const order = [...events].sort((a, b) => a.day - b.day);
  const byEvent = new Map(); for (const s of samples) { if (!byEvent.has(s.eventId)) byEvent.set(s.eventId, []); byEvent.get(s.eventId).push(s); }
  const rows = []; let model = null, space = null, lastFit = -Infinity, trainN = 0;
  const scored = [];                       // earlier predictions: raw probability and what happened
  order.forEach((test, idx) => {
    const group = byEvent.get(test.id); if (!group) return;
    const train = order.filter(e => e.day + o.H <= test.day);              // only events whose 14-day outcome was fully known
    if (train.length < o.minTrainEvents) return;
    const trainS = train.flatMap(e => byEvent.get(e.id) || []);
    if (idx - lastFit >= o.retrainEvery || !model) {
      space = new Space(trainS);
      model = fitLogistic(trainS.map(s => space.vec(s)), trainS.map(s => (s.doubled ? 1 : 0)), o.l2);
      lastFit = idx; trainN = trainS.length;
    }
    const hist = scored.filter(r => r.day + o.H <= test.day);     // only predictions whose outcome was fully known by now
    for (const s of group) {
      const j = judge(s, model, space, trainS, hist, o, cost, src);
      rows.push({ eventId: test.id, day: test.day, card: s.card, linkType: s.linkType, ...j, doubled: s.doubled, peak: s.peak, p0: s.p0 });
    }
    for (const r of rows.filter(r => r.eventId === test.id)) scored.push({ day: test.day, P: r.Praw, doubled: r.doubled });
  });
  return { rows, summary: summarizeScreen(rows, o, cost), trainSamples: trainN };
}

export function summarizeScreen(rows, o, cost) {
  const shown = rows.filter(r => r.shown), all = rows;
  const rate = (a) => (a.length ? a.filter(r => r.doubled).length / a.length : null);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const bins = [[0, 0.05], [0.05, 0.15], [0.15, 0.3], [0.3, 0.5], [0.5, 1.01]].map(([lo, hi]) => { const b = all.filter(r => r.P >= lo && r.P < hi); return { range: `${lo}-${Math.min(1, hi)}`, n: b.length, predicted: mean(b.map(r => r.P)), realized: rate(b) }; });
  const allDoublers = all.filter(r => r.doubled).length;
  return {
    considered: all.length, shown: shown.length,
    baseRate: rate(all), shownRate: rate(shown), meanPredictedShown: mean(shown.map(r => r.P)),
    recall: allDoublers ? shown.filter(r => r.doubled).length / allDoublers : null,
    lift: rate(all) ? (rate(shown) ?? 0) / rate(all) : null,
    calibration: bins,
  };
}

export function formatScreen(result, src, limit = 15) {
  const L = [`Considered ${result.summary.considered} linked cards; ${result.summary.shown} passed the gate.`];
  const s = result.summary;
  L.push(`Base rate of doubling: ${s.baseRate == null ? 'n/a' : (100 * s.baseRate).toFixed(1) + '%'}; shown cards doubled: ${s.shownRate == null ? 'n/a' : (100 * s.shownRate).toFixed(1) + '%'} (they were given ${s.meanPredictedShown == null ? 'n/a' : (100 * s.meanPredictedShown).toFixed(0) + '%'} on average, after correcting for the model's own track record).`);
  for (const r of result.rows.filter(r => r.shown).sort((a, b) => b.P - a.P).slice(0, limit)) L.push(`  ${String(src.keys[r.card]).padEnd(28)} ${r.linkType.padEnd(18)} chance ${(100 * r.P).toFixed(0)}%  past similar: ${r.analogDoubled}/${r.analogN} doubled  profit if it doubles: ¥${Math.round(r.netYenIfDoubled).toLocaleString()}` + (r.examples && r.examples.length ? `  e.g. ${r.examples.map(e => e.card + ' x' + e.peak).join(', ')}` : ''));
  return L.join('\n');
}

// ---- CLI (real data) ---------------------------------------------------------------------
// node pricescry-risers.mjs <data-dir> <past-events.json> <new-events.json> [out.json]
// Writes only the cards that PASSED the gate (the list the riser screen displays).
import { shardSource, loadEvents } from './pricescry-study.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , dataDir, pastFile, newFile, outFile] = process.argv;
  if (!dataDir || !pastFile || !newFile) { console.error('Usage: node pricescry-risers.mjs <data-dir> <past-events.json> <new-events.json> [out.json]'); process.exit(1); }
  const src = shardSource(dataDir), idx = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8'));
  const usdToJpy = (idx.fx && idx.fx.usdjpy) || 150;
  const res = liveScreen(loadEvents(pastFile), loadEvents(newFile), src, { usdToJpy });
  const shown = res.rows.filter(r => r.shown).sort((a, b) => b.P - a.P);
  console.log(res.note || `Judged ${res.rows.length} links from ${res.trainSamples} past cases; ${shown.length} passed the gate.`);
  for (const r of shown) console.log(`  ${r.name.padEnd(28)} ${r.linkType.padEnd(18)} chance ${(100 * r.P).toFixed(0)}%  similar past: ${r.analogDoubled}/${r.analogN}  buy up to ¥${r.plan.maxEntryYen.toLocaleString()}  target ¥${r.plan.targetYen.toLocaleString()}  stake ${(100 * (r.plan.stakePctCapped ?? r.plan.stakePct)).toFixed(1)}% of bankroll`);
  if (outFile) writeFileSync(outFile, JSON.stringify({ v: 1, asOf: res.asOf, gate: RISER_DEFAULTS.pShow, shown }, null, 1));
}
