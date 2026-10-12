// PriceScry backtest: "if the link engine had been running over the price history we already have, would its picks have risen?"
//
// How it works (no hindsight):
//   1. From Scryfall's bulk file, find every card whose FIRST printing falls inside the price-history window. Its event day is the day it was
//      previewed (when Scryfall records that), otherwise its release day.
//   2. For each such card, ask the link engine for candidates using ONLY cards that already existed on the event day, and only candidates
//      priced $2+ on that day. The prices are the ones recorded on that day.
//   3. Write those events as a synthetic shadow log in a scratch folder and score them with the SAME scorer the live scoreboard uses
//      (same-price-band control cards, Wilson intervals, 3/7/14 day horizons). So the result reads exactly like the live scoreboard.
//
// It never touches the real data folder: the scratch folder only links to the card files.
//
// Usage: node pricescry-backtest.mjs <scryfall-bulk.jsonl[.gz]> <data-dir> <out-dir>
// Writes <out-dir>/backtest-report.json and backtest-summary.txt.

import { createReadStream, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync, copyFileSync, readdirSync } from 'fs';
import { createInterface } from 'readline';
import { createGunzip, gzipSync, gunzipSync } from 'zlib';
import { join, resolve } from 'path';
import { dayIndex, isoFromDayIndex, nameKey, shardOf, shardFile, marketCentsAt, makeEurUsd, SHARDS } from './pricescry-lib.mjs';
import { buildIndex, linksFor, strongestType } from './pricescry-links.mjs';
import { evaluate } from './pricescry-shadow.mjs';

const SKIP_LAYOUTS = new Set(['token', 'double_faced_token', 'emblem', 'art_series']);
const MIN_CENTS = 200, TOP = 25;

async function readBulk(bulkPath) {                                     // one entry per card name: tuple, earliest release, preview day
  const head = readFileSync(bulkPath).subarray(0, 2);
  const input = head[0] === 0x1f && head[1] === 0x8b ? createReadStream(bulkPath).pipe(createGunzip()) : createReadStream(bulkPath);
  const byName = new Map();
  for await (const raw of createInterface({ input, crlfDelay: Infinity })) {
    const line = raw.trim().replace(/,$/, ''); if (!line || line === '[' || line === ']') continue;
    let c; try { c = JSON.parse(line); } catch { continue; }
    if (!c || c.object !== 'card' || SKIP_LAYOUTS.has(c.layout)) continue;
    if (Array.isArray(c.games) && !c.games.includes('paper')) continue;
    const faces = c.card_faces || [];
    const oracle = c.oracle_text || faces.map(f => f.oracle_text).filter(Boolean).join('\n');
    const rel = c.released_at || null, prev = c.preview && c.preview.previewed_at ? c.preview.previewed_at : null;
    const cur = byName.get(c.name);
    if (!cur) {
      byName.set(c.name, { rel, prev, set: c.set, tuple: [c.name, c.type_line || (faces[0] && faces[0].type_line) || '', oracle, c.mana_cost || (faces[0] && faces[0].mana_cost) || '', (c.color_identity || []).join(''), typeof c.cmc === 'number' ? c.cmc : 0, '', c.rarity || '', '', 0] });
    } else if (rel && (!cur.rel || rel < cur.rel)) { cur.rel = rel; cur.prev = prev; cur.set = c.set; }
    else if (rel && rel === cur.rel && prev && (!cur.prev || prev < cur.prev)) cur.prev = prev;
  }
  return byName;
}

export async function backtest({ bulkPath, dataDir, outDir, minLead = 14, maxEvents = 400 }) {
  const idx = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8')), latest = dayIndex(idx.day), eurUsd = (() => { const f = join(dataDir, 'fx.json'); return makeEurUsd(existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null); })();
  // price window: earliest day with any recorded price
  const shardCache = new Map();
  const loadShard = (n) => { if (!shardCache.has(n)) { const f = join(dataDir, shardFile(n)); shardCache.set(n, existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) : { cards: {} }); if (shardCache.size > 40) shardCache.delete(shardCache.keys().next().value); } return shardCache.get(n); };
  const recOf = (name) => { const k = nameKey(name); return loadShard(shardOf(k)).cards[k] || null; };
  let minDay = Infinity;
  for (const probe of ['Sol Ring', 'Lightning Bolt', 'Swords to Plowshares', 'Counterspell']) { const r = recOf(probe); if (!r) continue; for (const p of r.p) for (const s of Object.values(p.pr)) if (s.length) minDay = Math.min(minDay, s[0][0]); }
  if (!isFinite(minDay)) throw new Error('Could not find any price history.');
  const byName = await readBulk(bulkPath);
  const all = [...byName.values()].map(v => v.tuple);
  // events: first printed inside the window, early enough to have a 7-day result
  const events = [];
  for (const [name, v] of byName) {
    if (!v.rel) continue;
    const day = dayIndex(v.prev && v.prev <= v.rel ? v.prev : v.rel);
    if (day < minDay + 2 || day > latest - minLead) continue;
    if (/^basic|^plains$|^island$|^swamp$|^mountain$|^forest$/i.test(name) || /\bBasic\b/.test(v.tuple[1])) continue;
    events.push({ name, day, rel: v.rel, set: v.set, tuple: v.tuple });
  }
  events.sort((a, b) => a.day - b.day);
  const used = events.length > maxEvents ? events.filter((_, i) => i % Math.ceil(events.length / maxEvents) === 0) : events;
  // pool at each event day = cards whose first printing was on or before that day (no hindsight)
  const firstDay = new Map([...byName].map(([n, v]) => [n, v.rel ? dayIndex(v.rel) : 0]));
  const ixCache = new Map();
  const log = { v: 1, events: [] };
  let withCands = 0;
  for (const e of used) {
    const pool = all.filter(t => (firstDay.get(t[0]) || 0) <= e.day && t[0] !== e.name);
    pool.push(e.tuple);                                                  // the new card itself must be in the index for the engine to skip it
    const ix = buildIndex(pool);
    const cands = [];
    for (const h of linksFor(e.tuple, ix, { top: 150 })) {
      const rec = recOf(h.name); if (!rec) continue;
      const p0 = marketCentsAt(rec, e.day, eurUsd); if (p0 == null || p0 < MIN_CENTS) continue;
      cands.push({ n: h.name, k: nameKey(h.name), s: h.score, t: [...new Set(h.links.map(l => l.type))], main: strongestType(h), p0 });
      if (cands.length >= TOP) break;
    }
    if (cands.length) withCands++;
    log.events.push({ id: `${e.day}|${nameKey(e.name)}`, k: nameKey(e.name), day: e.day, n: e.name, set: e.set, preview: null, cands });
  }
  // scratch folder that the scorer can read
  mkdirSync(outDir, { recursive: true });
  const scratch = join(outDir, 'scratch'); mkdirSync(scratch, { recursive: true });
  const cardsLink = join(scratch, 'cards'); if (!existsSync(cardsLink)) symlinkSync(resolve(dataDir, 'cards'), cardsLink);
  copyFileSync(join(dataDir, 'index.json'), join(scratch, 'index.json'));
  if (existsSync(join(dataDir, 'fx.json'))) copyFileSync(join(dataDir, 'fx.json'), join(scratch, 'fx.json'));
  writeFileSync(join(scratch, 'shadow.json.gz'), gzipSync(Buffer.from(JSON.stringify(log))));
  const report = evaluate({ dataDir: scratch, minEvents: 5, minCandidates: 30 });
  report.backtest = { window: [isoFromDayIndex(minDay), idx.day], eventsFound: events.length, eventsUsed: used.length, eventsWithCandidates: withCands, note: 'Event day = preview date if Scryfall has one, otherwise release date. Candidate pool only contains cards that existed on the event day.' };
  writeFileSync(join(outDir, 'backtest-report.json'), JSON.stringify(report, null, 1));
  const L = [];
  L.push(`PriceScry backtest  (price history ${report.backtest.window[0]} to ${report.backtest.window[1]})`);
  L.push(`New cards found: ${events.length}; used: ${used.length}; with at least one $2+ candidate: ${withCands}`);
  L.push(`Status: ${report.status} - ${report.reason}`, '');
  for (const t of Object.keys(report.byType)) for (const h of Object.keys(report.byType[t])) {
    const r = report.byType[t][h]; if (!r) continue;
    const pc = (x) => x == null ? '  n/a' : (100 * x).toFixed(1).padStart(5) + '%';
    L.push(`${t.padEnd(9)} ${String(h).padStart(2)}d  events ${String(r.events).padStart(3)}  picks ${String(r.n).padStart(5)}  mean return ${pc(r.meanReturn)}  vs ordinary ${pc(r.meanReturn - r.meanAbnormal)}  hit(+25%) ${pc(r.hit25)} vs ordinary ${pc(r.control25)}  -> ${r.verdict}`);
  }
  writeFileSync(join(outDir, 'backtest-summary.txt'), L.join('\n') + '\n');
  return { report, summary: L.join('\n') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , bulk, dataDir, outDir] = process.argv;
  if (!bulk || !dataDir || !outDir) { console.error('Usage: node pricescry-backtest.mjs <scryfall-bulk> <data-dir> <out-dir>'); process.exit(1); }
  backtest({ bulkPath: bulk, dataDir, outDir }).then(r => console.log(r.summary)).catch(e => { console.error('Failed:', e.message); process.exit(1); });
}
