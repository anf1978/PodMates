// PriceScry bulk-jump backtest: the question behind the bulk-buying plan.
//
//   "When a new card is printed, do old cards that sell for pennies sometimes jump to 300 yen or more, and does the link engine
//    pick them out better than chance?"
//
// For every new card in the price history (first printing inside the window; event day = preview day, else release day):
//   * PICKS = the link engine's best cards that were already CHEAP on the event day (default: under 150 yen) and were first printed at least
//     14 days earlier (so no same-set cards and no hindsight).
//   * HIT   = the pick's price is at least 300 yen on EVERY one of the 3 days ending 7, 14 and 30 days later (a one-day blip on a thin market
//     does not count; three days in a row does). Prices are the shop-consensus price PriceScry already stores, converted at that day's rate.
//   * CONTROL = ordinary cheap cards in the same yen band on the same day (a quarter of all cards, every fourth one), judged the same way.
// Then it reports hit rates for picks vs control, per new card (so one busy card cannot count many times) with a 95% range, the same split by
// link type and by pick rank, a "basket" view (buy one copy of each pick; what is the whole basket worth later?), and every single hit by name.
//
// It never changes the data folder. Usage: node pricescry-bulkjump.mjs <scryfall-bulk> <data-dir> <out-dir>
// Writes bulkjump-summary.txt, bulkjump-report.json and bulkjump-hits.csv in <out-dir>.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';
import { SHARDS, dayIndex, isoFromDayIndex, nameKey, shardOf, shardFile, marketCentsAt, makeEurUsd, valueAt } from './pricescry-lib.mjs';
import { buildIndex, linksFor, strongestType } from './pricescry-links.mjs';
import { readBulk } from './pricescry-backtest.mjs';

const HORIZONS = [7, 14, 30], SUSTAIN = 3, TOP = 25, SETTLE_DAYS = 14, CONTROL_STEP = 4;
const BANDS = [[1, 30], [30, 60], [60, 100], [100, 150]];                       // yen on the event day
const bandOf = (y) => BANDS.findIndex(([lo, hi]) => y >= lo && y < hi);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
function boot(arr) { if (arr.length < 2) return [null, null]; let seed = 777; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; const m = []; for (let b = 0; b < 1000; b++) { let t = 0; for (let i = 0; i < arr.length; i++) t += arr[(rnd() * arr.length) | 0]; m.push(t / arr.length); } m.sort((x, y) => x - y); return [m[25], m[974]]; }

export async function bulkJump({ bulkPath, dataDir, outDir, minLead = 30, maxYen = 150 }) {
  const idx = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8')), latest = dayIndex(idx.day);
  const fxFile = join(dataDir, 'fx.json'), fxJson = existsSync(fxFile) ? JSON.parse(readFileSync(fxFile, 'utf8')) : null, eurUsd = makeEurUsd(fxJson);
  const usdjpy = (day) => { const s = fxJson && fxJson.pairs && fxJson.pairs.usdjpy; if (!s || !s.length) return 150; const v = valueAt(s, day); return (v === undefined ? s[0][1] : v) / 10000; };
  const yen = (cents, day) => (cents == null ? null : (cents / 100) * usdjpy(day));
  const shardCache = new Map();
  const loadShard = (n) => { if (!shardCache.has(n)) { const f = join(dataDir, shardFile(n)); shardCache.set(n, existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) : { cards: {} }); if (shardCache.size > 40) shardCache.delete(shardCache.keys().next().value); } return shardCache.get(n); };
  const recOf = (name) => { const k = nameKey(name); return loadShard(shardOf(k)).cards[k] || null; };
  let minDay = Infinity;
  for (const probe of ['Sol Ring', 'Lightning Bolt', 'Swords to Plowshares', 'Counterspell']) { const r = recOf(probe); if (!r) continue; for (const p of r.p) for (const s of Object.values(p.pr)) if (s.length) minDay = Math.min(minDay, s[0][0]); }
  if (!isFinite(minDay)) throw new Error('Could not find any price history.');
  const byName = await readBulk(bulkPath), all = [...byName.values()].map(v => v.tuple);
  const firstDay = new Map([...byName].map(([n, v]) => [n, v.rel ? dayIndex(v.rel) : 0]));
  const events = [];
  for (const [name, v] of byName) {
    if (!v.rel) continue;
    const day = dayIndex(v.prev && v.prev <= v.rel ? v.prev : v.rel);
    if (day < minDay + 16 || day > latest - minLead) continue;               // need 30 days of future, and 14 days of history so "cheap" is a real price
    if (/\bBasic\b/.test(v.tuple[1])) continue;
    events.push({ name, day, set: v.set, tuple: v.tuple });
  }
  events.sort((a, b) => a.day - b.day);
  const ix = buildIndex(all);
  // 1. picks per event
  const candsByKey = new Map();                                              // card key -> [{ei, rank, link types, ...}]
  events.forEach((e, ei) => {
    e.picks = [];
    for (const h of linksFor(e.tuple, ix, { top: 3000 })) {
      if ((firstDay.get(h.name) || 0) > e.day - SETTLE_DAYS) continue;
      const rec = recOf(h.name); if (!rec) continue;
      const c0 = marketCentsAt(rec, e.day, eurUsd), y0 = yen(c0, e.day);
      if (y0 == null || bandOf(y0) < 0 || y0 >= maxYen) continue;
      if (marketCentsAt(rec, e.day - SETTLE_DAYS, eurUsd) == null) continue;
      const k = nameKey(h.name), pk = { ei, n: h.name, k, rank: e.picks.length + 1, main: strongestType(h), types: [...new Set(h.links.map(l => l.type))], y0, band: bandOf(y0), res: {} };
      e.picks.push(pk); (candsByKey.get(k) || candsByKey.set(k, []).get(k)).push(pk);
      if (e.picks.length >= TOP) break;
    }
  });
  // 2. one pass over every card: judge the picks, and the control cards
  //    Three targets, because 300 yen from pennies turned out to be too rare to measure in 90 days (see the Bible, PriceScry backtests):
  //    "300 yen" (the original goal), "150 yen and 3x", "100 yen and 2x". A hit needs the price to stay at or above the target on each of
  //    SUSTAIN days in a row ending at the horizon, so a one-day blip does not count.
  const TARGETS = [{ label: '300 yen or more', abs: 300, mult: 1 }, { label: '150 yen or more AND at least 3x', abs: 150, mult: 3 }, { label: '100 yen or more AND at least 2x', abs: 100, mult: 2 }];
  const isHit = (t, y0, minY) => minY != null && minY >= t.abs && minY >= t.mult * y0;
  const ctl = events.map(() => HORIZONS.map(() => BANDS.map(() => ({ n: 0, hit: TARGETS.map(() => 0) }))));
  const sustained = (rec, day0, h) => {                                      // lowest yen price over the SUSTAIN days ending day0+h (null if a day has no price)
    let lo = Infinity;
    for (let d = day0 + h - SUSTAIN + 1; d <= day0 + h; d++) { const y = yen(marketCentsAt(rec, d, eurUsd), d); if (y == null) return null; if (y < lo) lo = y; }
    return lo;
  };
  let cardsSeen = 0;
  for (let n = 0; n < SHARDS; n++) {
    const sh = loadShard(n);
    for (const [key, rec] of Object.entries(sh.cards)) {
      cardsSeen++;
      const mine = candsByKey.get(key);
      if (mine) for (const pk of mine) { const e = events[pk.ei]; for (const h of HORIZONS) { const minY = sustained(rec, e.day, h); pk.res[h] = { minY, y: yen(marketCentsAt(rec, e.day + h, eurUsd), e.day + h) }; } }
      if (cardsSeen % CONTROL_STEP) continue;                                // control sample: every fourth card
      const cache = new Map();
      for (let ei = 0; ei < events.length; ei++) {
        const e = events[ei]; if (nameKey(e.name) === key) continue;
        let y0 = cache.get(e.day); if (y0 === undefined) { y0 = yen(marketCentsAt(rec, e.day, eurUsd), e.day); cache.set(e.day, y0); }
        if (y0 == null) continue; const bd = bandOf(y0); if (bd < 0 || y0 >= maxYen) continue;
        if (marketCentsAt(rec, e.day - SETTLE_DAYS, eurUsd) == null) continue;
        HORIZONS.forEach((h, hi) => { const minY = sustained(rec, e.day, h); const c = ctl[ei][hi][bd]; c.n++; TARGETS.forEach((t, ti) => { if (isHit(t, y0, minY)) c.hit[ti]++; }); });
      }
    }
    shardCache.delete(n);
  }
  // 3. numbers
  const out = { window: [isoFromDayIndex(minDay), idx.day], events: events.length, withPicks: events.filter(e => e.picks.length).length, targets: TARGETS, rows: [], hits: [] };
  const lines = [`PriceScry bulk-jump backtest   (price history ${out.window[0]} to ${out.window[1]})`,
    `Question: do cheap old cards (under ${maxYen} yen) jump after a linked new card is printed, more often than ordinary cheap cards?`,
    `New cards: ${events.length}; with at least one cheap pick: ${out.withPicks}; cards in the control sample: about ${Math.round(cardsSeen / CONTROL_STEP)}`, ''];
  const sections = [['all picks', () => true], ['top 5 picks', p => p.rank <= 5], ['tribal links', p => p.types.includes('tribal')], ['mechanic links', p => p.types.includes('mechanic')], ['enabler links', p => p.types.includes('enabler')]];
  const pc = (x) => (100 * x).toFixed(2) + '%';
  TARGETS.forEach((t, ti) => {
    lines.push(`################ TARGET: ${t.label} (price must stay there ${SUSTAIN} days in a row) ################`);
    HORIZONS.forEach((h, hi) => {
      lines.push(`=== ${h} days after the new card ===`);
      for (const [label, f] of sections) {
        const perEv = []; let picks = 0, hits = 0, ctlExpected = 0, basket0 = 0, basket1 = 0;
        events.forEach((e, ei) => {
          const ps = e.picks.filter(p => f(p) && p.res[h]); if (!ps.length) return;
          let hitsE = 0, expE = 0;
          for (const p of ps) { picks++; const cell = ctl[ei][hi][p.band], rate = cell.n ? cell.hit[ti] / cell.n : 0; expE += rate; ctlExpected += rate; if (isHit(t, p.y0, p.res[h].minY)) { hitsE++; hits++; } if (ti === 0) { basket0 += p.y0; basket1 += (p.res[h].y == null ? p.y0 : p.res[h].y); } }
          perEv.push((hitsE - expE) / ps.length);
        });
        if (!picks) { lines.push(`${label.padEnd(15)} no picks`); continue; }
        const [lo, hi2] = boot(perEv);
        const row = { target: t.label, horizon: h, group: label, picks, hits, expectedByChance: ctlExpected, hitRate: hits / picks, controlRate: ctlExpected / picks, events: perEv.length, edge: mean(perEv), edgeLow: lo, edgeHigh: hi2, basketReturn: ti === 0 ? basket1 / basket0 - 1 : null };
        out.rows.push(row);
        lines.push(`${label.padEnd(15)} picks ${String(picks).padStart(5)}  hits ${String(hits).padStart(4)} (${pc(row.hitRate)}); ordinary cheap cards would give about ${ctlExpected.toFixed(1)} (${pc(row.controlRate)})   edge per new card ${pc(row.edge)} [${pc(lo)} to ${pc(hi2)}]` + (ti === 0 ? `   basket of one of each pick: ${(100 * row.basketReturn).toFixed(1)}% in value` : ''));
      }
      lines.push('');
    });
  });
  // every pick that met any target, with the first horizon it did
  const seen = new Map();
  for (const e of events) for (const p of e.picks) for (const h of HORIZONS) {
    const r = p.res[h]; if (!r) continue;
    const met = TARGETS.map((t, ti) => isHit(t, p.y0, r.minY) ? ti : -1).filter(x => x >= 0); if (!met.length) continue;
    const k = e.name + '|' + p.n; if (seen.has(k)) continue;
    seen.set(k, { pick: p.n, fromYen: Math.round(p.y0), yenThen: Math.round(r.minY), horizonDays: h, newCard: e.name, set: e.set, eventDay: isoFromDayIndex(e.day), rank: p.rank, link: p.main, targetsMet: met.map(i => TARGETS[i].label).join(' / ') });
  }
  const uniq = [...seen.values()].sort((a, b) => b.yenThen / b.fromYen - a.yenThen / a.fromYen);
  out.hits = uniq;
  lines.push(`Every pick that met at least one target (first horizon it did so): ${uniq.length}`);
  for (const x of uniq.slice(0, 50)) lines.push(`  ${x.pick}  ${x.fromYen} yen -> ${x.yenThen} yen within ${x.horizonDays} days   (linked to ${x.newCard}, ${x.set}, rank ${x.rank}, ${x.link} link, ${x.eventDay}; met: ${x.targetsMet})`);
  lines.push('', 'Reading this: a "hit" means the shop-consensus price stayed at or above the target for three days. A paper price is not a sale; thin cards can show a price nobody pays.',
    'If ordinary cheap cards would give fewer than about 5 hits in a row, the test has too little to measure with: read it as "rare", not as "no edge".');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'bulkjump-summary.txt'), lines.join('\n') + '\n');
  writeFileSync(join(outDir, 'bulkjump-report.json'), JSON.stringify(out));
  writeFileSync(join(outDir, 'bulkjump-hits.csv'), 'pick,from_yen,yen_then,within_days,new_card,set,event_day,rank,link,targets_met\n' + uniq.map(x => [x.pick, x.fromYen, x.yenThen, x.horizonDays, x.newCard, x.set, x.eventDay, x.rank, x.link, x.targetsMet].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n') + '\n');
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , bulk, dataDir, outDir] = process.argv;
  if (!bulk || !dataDir || !outDir) { console.error('Usage: node pricescry-bulkjump.mjs <scryfall-bulk> <data-dir> <out-dir>'); process.exit(1); }
  bulkJump({ bulkPath: bulk, dataDir, outDir }).then(t => console.log(t)).catch(e => { console.error('Failed:', e.message); process.exit(1); });
}
