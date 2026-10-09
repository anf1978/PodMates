// PriceScry shadow predictions: the tool's honest, live report card.
//
// Every time a new card appears (a spoiler or a release, as logged in signals.json.gz), the link engine names the existing cards it
// thinks the new card could move. We WRITE THAT DOWN with the price and the date, before anything happens. Days later we look at
// what those cards actually did, compare them with ordinary cards of a similar price, and score each kind of link.
// Nothing here is a recommendation. It is how the tool finds out, with no hindsight, which of its ideas deserve to be trusted.
//
// Usage:
//   node pricescry-shadow.mjs log  <scryfall-default-cards.jsonl[.gz]> <data-dir>     (daily, after the prices are in)
//   node pricescry-shadow.mjs eval <data-dir>                                          (daily; writes shadow-report.json)
//
// Files in <data-dir>: shadow.json.gz (the log, never edited, only appended) and shadow-report.json (the scoreboard the page reads).

import { createReadStream, existsSync, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { createGunzip, gzipSync, gunzipSync } from 'zlib';
import { join } from 'path';
import { SHARDS, dayIndex, isoFromDayIndex, nameKey, shardOf, shardFile, marketCentsAt, makeEurUsd } from './pricescry-lib.mjs';
import { buildIndex, linksFor, strongestType } from './pricescry-links.mjs';

const MIN_CENTS = 200;                               // only cards worth $2 or more are candidates (same bar as the movers list)
const HORIZONS = [3, 7, 14];
const BANDS = [[200, 500], [500, 1000], [1000, 3000], [3000, Infinity]];
const bandOf = (c) => BANDS.findIndex(([lo, hi]) => c >= lo && c < hi);
const SKIP_LAYOUTS = new Set(['token', 'double_faced_token', 'emblem', 'art_series']);

const readGz = (f, fallback) => (existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) : fallback);
function loadFx(dataDir) { const f = join(dataDir, 'fx.json'); return makeEurUsd(existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null); }
function loadShard(dataDir, n) { const f = join(dataDir, shardFile(n)); return existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) : { cards: {} }; }

async function tuplesFromBulk(bulkPath) {            // one tuple per card name, in the shape the link engine expects
  const head = readFileSync(bulkPath).subarray(0, 2);
  const input = head[0] === 0x1f && head[1] === 0x8b ? createReadStream(bulkPath).pipe(createGunzip()) : createReadStream(bulkPath);
  const seen = new Set(), tuples = [];
  for await (const raw of createInterface({ input, crlfDelay: Infinity })) {
    const line = raw.trim().replace(/,$/, ''); if (!line || line === '[' || line === ']') continue;
    let c; try { c = JSON.parse(line); } catch { continue; }
    if (!c || c.object !== 'card' || SKIP_LAYOUTS.has(c.layout) || seen.has(c.name)) continue;
    if (Array.isArray(c.games) && !c.games.includes('paper')) continue;
    seen.add(c.name);
    const faces = c.card_faces || [];
    const oracle = c.oracle_text || faces.map(f => f.oracle_text).filter(Boolean).join('\n');
    tuples.push([c.name, c.type_line || (faces[0] && faces[0].type_line) || '', oracle, c.mana_cost || (faces[0] && faces[0].mana_cost) || '', (c.color_identity || []).join(''), typeof c.cmc === 'number' ? c.cmc : 0, '', c.rarity || '', '', 0]);
  }
  return tuples;
}

// ---- 1. write the predictions down ----------------------------------------------------------------------------------
export async function logShadow({ bulkPath, dataDir, lookbackDays = 7, top = 25, minCents = MIN_CENTS }) {
  const sigFile = join(dataDir, 'signals.json.gz'), logFile = join(dataDir, 'shadow.json.gz');
  const idx = existsSync(join(dataDir, 'index.json')) ? JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8')) : null;
  if (!idx) throw new Error('No index.json in the data folder.');
  const today = dayIndex(idx.day);
  const events = readGz(sigFile, []).filter(e => e.type === 'new_card' && e.day >= today - lookbackDays);
  const log = readGz(logFile, { v: 1, events: [] });
  const have = new Set(log.events.map(e => e.id));
  const fresh = events.filter(e => !have.has(`${e.day}|${e.k}`));
  if (!fresh.length) return { newEvents: 0, logged: log.events.length };
  const tuples = await tuplesFromBulk(bulkPath), ix = buildIndex(tuples), byName = new Map(tuples.map(t => [t[0].toLowerCase(), t]));
  const eurUsd = loadFx(dataDir), shardCache = new Map();
  const recOf = (name) => { const k = nameKey(name), n = shardOf(k); if (!shardCache.has(n)) shardCache.set(n, loadShard(dataDir, n)); return shardCache.get(n).cards[k] || null; };
  let added = 0;
  for (const e of fresh) {
    const t = byName.get(String(e.n).toLowerCase()); if (!t) continue;
    const cands = [];
    for (const h of linksFor(t, ix, { top: 150 })) {
      const rec = recOf(h.name); if (!rec) continue;
      const p0 = marketCentsAt(rec, e.day, eurUsd); if (p0 == null || p0 < minCents) continue;
      cands.push({ n: h.name, k: nameKey(h.name), s: h.score, t: [...new Set(h.links.map(l => l.type))], main: strongestType(h), p0 });
      if (cands.length >= top) break;
    }
    log.events.push({ id: `${e.day}|${e.k}`, day: e.day, n: e.n, set: e.set || null, preview: e.preview || null, cands });
    added++;
  }
  log.events = log.events.filter(e => e.day >= today - 400);
  writeFileSync(logFile, gzipSync(Buffer.from(JSON.stringify(log)), { level: 9 }));
  return { newEvents: added, logged: log.events.length };
}

// ---- 2. score them, with no hindsight ----------------------------------------------------------------------------------
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export function wilson(k, n, z = 1.96) { if (!n) return [null, null]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)]; }

export function evaluate({ dataDir, horizons = HORIZONS, minEvents = 5, minCandidates = 30 }) {
  const log = readGz(join(dataDir, 'shadow.json.gz'), { v: 1, events: [] });
  const idx = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8')), latest = dayIndex(idx.day), eurUsd = loadFx(dataDir);
  // which (event, horizon) pairs have fully played out
  const jobs = []; for (const ev of log.events) for (const h of horizons) if (ev.day + h <= latest) jobs.push({ ev, h, candNames: new Set(ev.cands.map(c => c.k)), ctrl: BANDS.map(() => []) });
  const candRet = new Map();                                                       // `${event id}|${h}|${card key}` -> return
  if (jobs.length) {
    for (let n = 0; n < SHARDS; n++) {
      const shard = loadShard(dataDir, n);
      for (const [key, rec] of Object.entries(shard.cards)) {
        for (const j of jobs) {
          const p0 = marketCentsAt(rec, j.ev.day, eurUsd), p1 = marketCentsAt(rec, j.ev.day + j.h, eurUsd);
          if (p0 == null || p1 == null || p0 < MIN_CENTS) continue;
          const cand = j.candNames.has(key);
          if (cand) { const c = j.ev.cands.find(x => x.k === key); candRet.set(`${j.ev.id}|${j.h}|${key}`, p1 / c.p0 - 1); }   // judged from the price WRITTEN DOWN at the time
          else if (nameKey(j.ev.n) !== key) j.ctrl[bandOf(p0)].push(p1 / p0 - 1);
        }
      }
    }
  }
  const byType = {}; const types = ['any', 'top5', 'named', 'tribal', 'mechanic', 'enabler'];
  for (const t of types) byType[t] = {};
  for (const h of horizons) {
    const hjobs = jobs.filter(j => j.h === h);
    const acc = Object.fromEntries(types.map(t => [t, { events: new Set(), n: 0, r: [], abn: [], ctrl25: [], ctrl100: [] }]));
    for (const j of hjobs) {
      const ctrlMed = j.ctrl.map(a => median(a)), ctrl25 = j.ctrl.map(a => (a.length ? a.filter(x => x >= 0.25).length / a.length : null)), ctrl100 = j.ctrl.map(a => (a.length ? a.filter(x => x >= 1).length / a.length : null));
      j.ev.cands.forEach((c, rank) => {
        const r = candRet.get(`${j.ev.id}|${h}|${c.k}`); if (r === undefined) return;
        const b = bandOf(c.p0); if (b < 0 || ctrlMed[b] == null) return;
        const tags = ['any']; if (rank < 5) tags.push('top5'); for (const t of c.t) if (acc[t]) tags.push(t);
        for (const t of new Set(tags)) { const a = acc[t]; a.events.add(j.ev.id); a.n++; a.r.push(r); a.abn.push(r - ctrlMed[b]); a.ctrl25.push(ctrl25[b]); a.ctrl100.push(ctrl100[b]); }
      });
    }
    for (const t of types) {
      const a = acc[t]; if (!a.n) continue;
      const k25 = a.r.filter(x => x >= 0.25).length, k100 = a.r.filter(x => x >= 1).length, [lo25, hi25] = wilson(k25, a.n), [lo100] = wilson(k100, a.n), c25 = mean(a.ctrl25.filter(x => x != null)), c100 = mean(a.ctrl100.filter(x => x != null));
      const enough = a.events.size >= minEvents && a.n >= minCandidates;
      let verdict = 'too early';
      if (enough) verdict = (lo25 > c25 && mean(a.abn) > 0) ? 'beats ordinary cards' : (hi25 < c25 || mean(a.abn) < 0) ? 'no edge' : 'inconclusive';
      byType[t][h] = { events: a.events.size, n: a.n, meanReturn: mean(a.r), meanAbnormal: mean(a.abn), medianAbnormal: median(a.abn), hit25: k25 / a.n, hit25Low: lo25, hit100: k100 / a.n, control25: c25, control100: c100, verdict };
    }
  }
  const settled = log.events.filter(e => horizons.some(h => e.day + h <= latest)).length;
  const main = byType.any[7] || byType.any[3];
  let status, reason;
  if (!log.events.length) { status = 'collecting'; reason = 'No new cards have been logged yet.'; }
  else if (!main || main.verdict === 'too early') { status = 'collecting'; reason = `${log.events.length} new cards logged, ${settled} old enough to score. Verdicts need at least ${minEvents} scored events and ${minCandidates} candidates per link type.`; }
  else if (main.verdict === 'beats ordinary cards') { status = 'promising'; reason = `Linked cards rose by 25% or more in 7 days about ${Math.round(main.hit25 * 100)}% of the time against ${Math.round(main.control25 * 100)}% for ordinary cards of the same price.`; }
  else if (main.verdict === 'no edge') { status = 'not working yet'; reason = 'Linked cards did no better than ordinary cards of the same price.'; }
  else { status = 'inconclusive'; reason = 'Results so far are too close to call.'; }
  const recent = log.events.slice(-8).reverse().map(e => ({ day: isoFromDayIndex(e.day), n: e.n, set: e.set, cands: e.cands.length, top: e.cands.slice(0, 3).map(c => ({ n: c.n, t: c.main, r7: candRet.get(`${e.id}|7|${c.k}`) ?? null })) }));
  const report = { v: 1, day: idx.day, events: log.events.length, scoredEvents: settled, horizons, status, reason, byType, recent, thresholds: { minEvents, minCandidates, hitBar: 0.25 } };
  writeFileSync(join(dataDir, 'shadow-report.json'), JSON.stringify(report));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , cmd, a, b] = process.argv;
  const run = async () => {
    if (cmd === 'log' && a && b) return console.log('Shadow log:', JSON.stringify(await logShadow({ bulkPath: a, dataDir: b })));
    if (cmd === 'eval' && a) { const r = evaluate({ dataDir: a }); return console.log('Shadow report:', r.status, '-', r.reason); }
    console.error('Usage:\n  node pricescry-shadow.mjs log <scryfall-bulk> <data-dir>\n  node pricescry-shadow.mjs eval <data-dir>'); process.exit(1);
  };
  run().catch(e => { console.error('Failed:', e.message); process.exit(1); });
}
