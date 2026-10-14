// PriceScry cheap-pick watch: the forward-looking version of the bulk-jump backtest.
//
// THE IDEA
//   When a new card appears (a real spoiler/release picked up by the daily snapshot, or a leak you paste into pricescry-spoilers.txt), the link
//   engine names old CHEAP cards (under 150 yen on that day, first printed at least 14 days earlier) that the new card might lift. We write down
//   those picks and their prices that day. 14, 30, 45 and 60 days later we score them: did the price stay at or above the target three days in a
//   row, and did that happen more often than for ordinary cheap cards in the same yen band? Targets: 300 yen; 150 yen and 3x; 100 yen and 2x.
//   Evidence is counted per SET (new cards from one release are one event), so the verdict cannot be fooled by one busy set.
//   It also lists what is moving right now (cheap picks up 1.5x or more since their card appeared) and what is being watched, for paper trades.
//
// Files in <data-dir>: cheapwatch.json.gz (the log; each scored result is stored once and never recomputed) and cheapwatch-report.json (read by the page).
// Pasted leaks also go into radar-events.json, so the $2+ prediction scoreboard learns from them too.
//
// Usage:
//   node pricescry-cheapwatch.mjs log  <scryfall-bulk.jsonl[.gz]> <data-dir> [pricescry-spoilers.txt]
//   node pricescry-cheapwatch.mjs eval <data-dir>

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { gunzipSync, gzipSync } from 'zlib';
import { join } from 'path';
import { SHARDS, dayIndex, isoFromDayIndex, nameKey, shardOf, shardFile, marketCentsAt, makeEurUsd, valueAt } from './pricescry-lib.mjs';
import { buildIndex, linksFor, strongestType } from './pricescry-links.mjs';
import { readBulk } from './pricescry-backtest.mjs';
import { colorsOf, cmcOf } from './pricescry-radar.mjs';

export const HORIZONS = [14, 30, 45, 60];
export const TARGETS = [{ label: '300 yen or more', abs: 300, mult: 1 }, { label: '150 yen or more AND at least 3x', abs: 150, mult: 3 }, { label: '100 yen or more AND at least 2x', abs: 100, mult: 2 }];
const SUSTAIN = 3, MAX_YEN = 150, SETTLE_DAYS = 14, TOP = 25, CONTROL_STEP = 4, BANDS = [[1, 30], [30, 60], [60, 100], [100, 150]];
const bandOf = (y) => BANDS.findIndex(([lo, hi]) => y >= lo && y < hi);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const isHit = (t, y0, minY) => minY != null && minY >= t.abs && minY >= t.mult * y0;
function boot(arr) { if (arr.length < 2) return [null, null]; let seed = 4242; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; const m = []; for (let b = 0; b < 1000; b++) { let t = 0; for (let i = 0; i < arr.length; i++) t += arr[(rnd() * arr.length) | 0]; m.push(t / arr.length); } m.sort((x, y) => x - y); return [m[25], m[974]]; }

const readGz = (f, fallback) => (existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) : fallback);
function context(dataDir) {
  const fxFile = join(dataDir, 'fx.json'), fxJson = existsSync(fxFile) ? JSON.parse(readFileSync(fxFile, 'utf8')) : null, eurUsd = makeEurUsd(fxJson);
  const usdjpy = (day) => { const s = fxJson && fxJson.pairs && fxJson.pairs.usdjpy; if (!s || !s.length) return 150; const v = valueAt(s, day); return (v === undefined ? s[0][1] : v) / 10000; };
  const yen = (cents, day) => (cents == null ? null : (cents / 100) * usdjpy(day));
  const cache = new Map();
  const loadShard = (n) => { if (!cache.has(n)) { const f = join(dataDir, shardFile(n)); cache.set(n, existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) : { cards: {} }); if (cache.size > 40) cache.delete(cache.keys().next().value); } return cache.get(n); };
  const recOf = (name) => { const k = nameKey(name); return loadShard(shardOf(k)).cards[k] || null; };
  const sustained = (rec, day0, h) => { let lo = Infinity; for (let d = day0 + h - SUSTAIN + 1; d <= day0 + h; d++) { const y = yen(marketCentsAt(rec, d, eurUsd), d); if (y == null) return null; if (y < lo) lo = y; } return lo; };
  return { eurUsd, yen, loadShard, recOf, sustained, dropShard: (n) => cache.delete(n) };
}

// ---- pasted leaks: plain text, easy to edit on GitHub --------------------------------------------------------------------
// Blocks separated by a line of ---. Line 1 = card name. Line 2 = "{2}{G}{G} | Legendary Creature — Elf Druid" (cost | type line; cost optional).
// Remaining lines = rules text. A line "rarity: rare" is optional. Lines starting with # are ignored.
export function parseSpoilers(text) {
  const out = [];
  for (const block of String(text || '').split(/^\s*-{3,}\s*$/m)) {
    const lines = block.split('\n').map(l => l.replace(/\r/g, '').trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length < 2) continue;
    const name = lines[0].slice(0, 80); let cost = '', type = lines[1], rest = lines.slice(2), rarity = '';
    if (lines[1].includes('|')) { const [c, t] = lines[1].split('|'); cost = c.trim().slice(0, 40); type = t.trim(); }
    type = type.slice(0, 100);
    rest = rest.filter(l => { const m = /^rarity:\s*(\w+)/i.exec(l); if (m) { rarity = m[1].toLowerCase(); return false; } return true; });
    if (name.length < 2 || !type) continue;
    out.push({ name, cost, type, text: rest.join('\n').slice(0, 900), rarity });
  }
  return out;
}

// ---- 1. write the picks down ---------------------------------------------------------------------------------------
export async function logCheap({ bulkPath, dataDir, spoilerFile, lookbackDays = 7 }) {
  const idx = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8')), today = dayIndex(idx.day);
  const logFile = join(dataDir, 'cheapwatch.json.gz');
  const log = readGz(logFile, { v: 1, events: [] });
  const haveK = new Set(log.events.map(e => e.k));
  const sig = readGz(join(dataDir, 'signals.json.gz'), []).filter(e => e.type === 'new_card' && e.day >= today - lookbackDays && !haveK.has(e.k));
  const manual = spoilerFile && existsSync(spoilerFile) ? parseSpoilers(readFileSync(spoilerFile, 'utf8')).filter(c => !haveK.has(nameKey(c.name))) : [];
  if (!sig.length && !manual.length) return { newEvents: 0, manual: 0, logged: log.events.length };
  const byName = await readBulk(bulkPath), all = [...byName.values()].map(v => v.tuple), ix = buildIndex(all);
  const firstDay = new Map([...byName].map(([n, v]) => [n, v.rel ? dayIndex(v.rel) : 0]));
  const { eurUsd, yen, recOf } = context(dataDir);
  const picksFor = (tuple, day) => {
    const cheap = [], dollar = [];
    for (const h of linksFor(tuple, ix, { top: 3000 })) {
      if ((firstDay.get(h.name) || 0) > day - SETTLE_DAYS) continue;
      const rec = recOf(h.name); if (!rec) continue;
      const c0 = marketCentsAt(rec, day, eurUsd); if (c0 == null) continue;
      const base = { n: h.name, k: nameKey(h.name), s: h.score, t: [...new Set(h.links.map(l => l.type))], main: strongestType(h), p0: c0 };
      if (c0 >= 200 && dollar.length < TOP) dollar.push(base);              // for the $2+ prediction scoreboard (pasted leaks only)
      const y0 = yen(c0, day); if (y0 == null || bandOf(y0) < 0 || y0 >= MAX_YEN) continue;
      if (marketCentsAt(rec, day - SETTLE_DAYS, eurUsd) == null) continue;
      if (cheap.length < TOP) cheap.push({ n: h.name, k: base.k, s: h.score, types: base.t, main: base.main, y0: Math.round(y0 * 10) / 10 });
      if (cheap.length >= TOP && dollar.length >= TOP) break;
    }
    return { cheap, dollar };
  };
  let added = 0, addedManual = 0;
  for (const e of sig) {
    const v = byName.get(e.n); if (!v) continue;
    const { cheap } = picksFor(v.tuple, e.day);
    log.events.push({ id: `${e.day}|${e.k}`, k: e.k, n: e.n, day: e.day, set: e.set || null, src: 'new_card', picks: cheap, done: {} }); added++;
  }
  const radarFile = join(dataDir, 'radar-events.json'), radar = existsSync(radarFile) ? JSON.parse(readFileSync(radarFile, 'utf8')) : { v: 1, events: [] };
  for (const c of manual) {
    const k = nameKey(c.name); if (byName.has(c.name)) continue;                     // already a real card: the normal route covers it
    const tuple = [c.name, c.type, c.text, c.cost, colorsOf(c.cost, c.text), cmcOf(c.cost), '', c.rarity, '', 0];
    const { cheap, dollar } = picksFor(tuple, today);
    log.events.push({ id: `${today}|${k}`, k, n: c.name, day: today, set: 'leak', src: 'pasted', picks: cheap, done: {} }); addedManual++;
    if (!(radar.events || []).some(e => e.k === k)) (radar.events = radar.events || []).push({ id: `${today}|${k}`, day: today, k, n: c.name, set: 'leak', preview: { s: 'pasted' }, cands: dollar });
  }
  if (addedManual) writeFileSync(radarFile, JSON.stringify({ v: 1, events: (radar.events || []).filter(e => e.day >= today - 60) }));
  log.events = log.events.filter(e => e.day >= today - 400);
  writeFileSync(logFile, gzipSync(Buffer.from(JSON.stringify(log)), { level: 9 }));
  return { newEvents: added, manual: addedManual, logged: log.events.length };
}

// ---- 2. score what has had time to play out, and write the report --------------------------------------------------------
export function evalCheap({ dataDir }) {
  const logFile = join(dataDir, 'cheapwatch.json.gz');
  const log = readGz(logFile, { v: 1, events: [] });
  const idx = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8')), latest = dayIndex(idx.day);
  const ctx = context(dataDir), { yen, loadShard, sustained, eurUsd } = ctx;
  // newly matured (event, horizon) pairs
  const jobs = []; for (const ev of log.events) for (const h of HORIZONS) if (ev.day + h <= latest && !(ev.done && ev.done[h])) jobs.push({ ev, h, picks: [], ctl: BANDS.map(() => ({ n: 0, hit: TARGETS.map(() => 0) })) });
  const pickMap = new Map(); jobs.forEach((j, ji) => j.ev.picks.forEach((p, pi) => { (pickMap.get(p.k) || pickMap.set(p.k, []).get(p.k)).push([ji, pi]); }));
  if (jobs.length) {
    const days = [...new Set(jobs.map(j => j.ev.day))];
    let seen = 0;
    for (let n = 0; n < SHARDS; n++) {
      const sh = loadShard(n);
      for (const [key, rec] of Object.entries(sh.cards)) {
        seen++;
        const mine = pickMap.get(key);
        if (mine) for (const [ji, pi] of mine) { const j = jobs[ji]; j.picks[pi] = { k: key, minY: sustained(rec, j.ev.day, j.h), yEnd: yen(marketCentsAt(rec, j.ev.day + j.h, eurUsd), j.ev.day + j.h) }; }
        if (seen % CONTROL_STEP) continue;
        const y0Cache = new Map(); for (const d of days) y0Cache.set(d, yen(marketCentsAt(rec, d, eurUsd), d));
        for (const j of jobs) {
          if (j.ev.k === key) continue;
          const y0 = y0Cache.get(j.ev.day); if (y0 == null) continue; const b = bandOf(y0); if (b < 0 || y0 >= MAX_YEN) continue;
          if (marketCentsAt(rec, j.ev.day - SETTLE_DAYS, eurUsd) == null) continue;
          const minY = sustained(rec, j.ev.day, j.h), c = j.ctl[b]; c.n++; TARGETS.forEach((t, ti) => { if (isHit(t, y0, minY)) c.hit[ti]++; });
        }
      }
      ctx.dropShard(n);
    }
    for (const j of jobs) {
      if (!j.ev.done) j.ev.done = {};
      j.ev.done[j.h] = { p: j.ev.picks.map((p, i) => (j.picks[i] && j.picks[i].minY != null ? [Math.round(j.picks[i].minY * 10) / 10, j.picks[i].yEnd == null ? null : Math.round(j.picks[i].yEnd * 10) / 10] : null)), c: j.ctl };
    }
    writeFileSync(logFile, gzipSync(Buffer.from(JSON.stringify(log)), { level: 9 }));
  }
  // report
  const groups = [['all', () => true], ['top5', (p, i) => i < 5], ['tribal', p => p.types.includes('tribal')], ['mechanic', p => p.types.includes('mechanic')], ['enabler', p => p.types.includes('enabler')]];
  const rows = [], hitCards = new Map();
  TARGETS.forEach((t, ti) => HORIZONS.forEach(h => groups.forEach(([gname, f]) => {
    let picks = 0, hits = 0, exp = 0; const bySet = new Map(), setsSeen = new Set();
    for (const ev of log.events) {
      const d = ev.done && ev.done[h]; if (!d) continue;
      let hitsE = 0, expE = 0, nE = 0;
      ev.picks.forEach((p, i) => {
        if (!f(p, i) || !d.p[i]) return;
        const [minY, yEnd] = d.p[i], cell = d.c[bandOf(p.y0)], rate = cell && cell.n ? cell.hit[ti] / cell.n : 0;
        nE++; expE += rate; if (isHit(t, p.y0, minY)) { hitsE++; if (gname === 'all') { const k = ev.set + '|' + p.k; if (!hitCards.has(p.k) || hitCards.get(p.k).h > h) hitCards.set(p.k, { n: p.n, from: p.y0, to: yEnd == null ? minY : yEnd, h, newCard: ev.n, set: ev.set, target: t.label }); } }
      });
      if (!nE) continue; picks += nE; hits += hitsE; exp += expE; const sk = ev.set || ev.n; (bySet.get(sk) || bySet.set(sk, []).get(sk)).push((hitsE - expE) / nE); setsSeen.add(sk);
    }
    if (!picks) return;
    const [lo, hi] = boot([...bySet.values()].map(a => mean(a)));
    rows.push({ target: t.label, horizon: h, group: gname, picks, hits, expected: Math.round(exp * 100) / 100, sets: setsSeen.size, edge: mean([...bySet.values()].map(a => mean(a))), low: lo, high: hi });
  })));
  // verdict on the loosest target at 30 days, all picks
  const main = rows.find(r => r.target === TARGETS[2].label && r.horizon === 30 && r.group === 'all');
  let status = 'collecting', reason = '';
  const scoredEvents = log.events.filter(e => e.done && Object.keys(e.done).length).length;
  if (!log.events.length) reason = 'Nothing logged yet.';
  else if (!main) reason = `${log.events.length} new cards logged. The first results appear 14 days after the first one.`;
  else if (main.sets < 5 || main.expected < 5) reason = `${main.sets} release(s) scored so far, and ordinary cheap cards would give only about ${main.expected} hits. A verdict needs at least 5 releases and 5 expected hits.`;
  else if (main.low > 0) { status = 'promising'; reason = `Cheap picks reached 100 yen and 2x within 30 days more often than ordinary cheap cards (${main.hits} hits against about ${main.expected} expected, ${main.sets} releases).`; }
  else if (main.high < 0.0005) { status = 'not working yet'; reason = 'Cheap picks did no better than ordinary cheap cards.'; }
  else { status = 'inconclusive'; reason = 'Results are too close to call.'; }
  // what is being watched and what is moving now
  const recentEvents = log.events.filter(e => e.day >= latest - 60 && e.picks.length);
  const wanted = new Map(); for (const ev of recentEvents) for (const p of ev.picks) { const n = shardOf(p.k); (wanted.get(n) || wanted.set(n, []).get(n)).push(p.k); }
  const now = new Map();
  for (const [n, keys] of wanted) { const sh = loadShard(n); for (const k of keys) { const rec = sh.cards[k]; if (rec) now.set(k, yen(marketCentsAt(rec, latest, eurUsd), latest)); } ctx.dropShard(n); }
  const moving = new Map();
  for (const ev of recentEvents) ev.picks.forEach((p, i) => {
    const y = now.get(p.k); if (y == null || y < 50 || y < 1.5 * p.y0) return;
    const cur = moving.get(p.k); const item = { n: p.n, from: p.y0, now: Math.round(y), ratio: Math.round(y / p.y0 * 10) / 10, newCard: ev.n, set: ev.set, day: isoFromDayIndex(ev.day), rank: i + 1, type: p.main };
    if (!cur || item.ratio > cur.ratio) moving.set(p.k, item);
  });
  const watching = log.events.filter(e => e.day >= latest - 45 && e.picks.length).sort((a, b) => b.day - a.day).slice(0, 12).map(e => ({ n: e.n, day: isoFromDayIndex(e.day), set: e.set, src: e.src, picks: e.picks.slice(0, 8).map(p => ({ n: p.n, from: p.y0, now: now.has(p.k) && now.get(p.k) != null ? Math.round(now.get(p.k)) : null, type: p.main })) }));
  const report = { v: 1, day: idx.day, status, reason, events: log.events.length, scoredEvents, targets: TARGETS.map(t => t.label), horizons: HORIZONS, rows, hitCards: [...hitCards.values()].sort((a, b) => b.to / b.from - a.to / a.from).slice(0, 40), moving: [...moving.values()].sort((a, b) => b.ratio - a.ratio).slice(0, 30), watching, thresholds: { maxYen: MAX_YEN, sustainDays: SUSTAIN, minReleases: 5, minExpectedHits: 5 } };
  writeFileSync(join(dataDir, 'cheapwatch-report.json'), JSON.stringify(report));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , cmd, a, b, c] = process.argv;
  const run = async () => {
    if (cmd === 'log' && a && b) return console.log('Cheap watch log:', JSON.stringify(await logCheap({ bulkPath: a, dataDir: b, spoilerFile: c })));
    if (cmd === 'eval' && a) { const r = evalCheap({ dataDir: a }); return console.log('Cheap watch report:', r.status, '-', r.reason, `| moving now: ${r.moving.length}`); }
    console.error('Usage:\n  node pricescry-cheapwatch.mjs log <scryfall-bulk> <data-dir> [pricescry-spoilers.txt]\n  node pricescry-cheapwatch.mjs eval <data-dir>'); process.exit(1);
  };
  run().catch(e => { console.error('Failed:', e.message); process.exit(1); });
}
