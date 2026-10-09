// PriceScry: TCGplayer prices, once a day, from tcgcsv.com (a free public mirror of TCGplayer's catalogue and prices).
//
// Usage: node pricescry-tcgplayer.mjs <scryfall-default-cards.jsonl[.gz]> <data-dir> [--base URL] [--delay ms] [--max-groups N]
//
// WHY: it is a second, direct view of TCGplayer: market price AND the lowest listing (the gap between them says how thin the
// market is), per version. It also reads each set's release date, which feeds the catalyst calendar (catalysts.json).
//
// BEING A GOOD GUEST (the site's owner asked for this, and removed his history archive partly because of load):
//   - one identified request at a time, with a pause between requests (default 400 ms);
//   - each price file is requested AT MOST ONCE per day (state kept in tcg-state.json, so a re-run or a crash costs nothing);
//   - after a first full pass we only ask for sets that contain cards we track, and re-check the rest monthly;
//   - on HTTP 403 we stop at once and do not retry; on 429 or 5xx we wait and retry a few times, then give up for today.
//
// Series written onto each printing (kept apart from MTGJSON's so the shop-consensus price is never double counted):
//   qn  market price, non-foil     ql  lowest listing, non-foil     qf  market price, foil     qe  market price, etched foil
//
// Product ids are matched to Scryfall printings through Scryfall's own tcgplayer_id / tcgplayer_etched_id fields.

import { createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createInterface } from 'readline';
import { createGunzip, gzipSync, gunzipSync } from 'zlib';
import { join } from 'path';
import { SHARDS, dayIndex, isoFromDayIndex, shardFile, applyPoint } from './pricescry-lib.mjs';

const UA = 'PodMatesPriceScry/1.0 (+https://github.com/anf1978/PodMates)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function buildProductMap(bulkPath) {            // productId -> { sid, etched }
  const head = readFileSync(bulkPath).subarray(0, 2);
  const input = head[0] === 0x1f && head[1] === 0x8b ? createReadStream(bulkPath).pipe(createGunzip()) : createReadStream(bulkPath);
  const map = new Map(); let cards = 0;
  for await (const raw of createInterface({ input, crlfDelay: Infinity })) {
    const line = raw.trim().replace(/,$/, ''); if (!line || line === '[' || line === ']') continue;
    let c; try { c = JSON.parse(line); } catch { continue; }
    if (!c || c.object !== 'card') continue; cards++;
    if (c.tcgplayer_id) map.set(Number(c.tcgplayer_id), { sid: c.id, etched: false });
    if (c.tcgplayer_etched_id) map.set(Number(c.tcgplayer_etched_id), { sid: c.id, etched: true });
  }
  if (cards < 1000) throw new Error('The Scryfall file had too few cards to build the product map from.');
  return map;
}

class Blocked extends Error {}
export function makeFetcher({ base, delay = 400, retries = 3, log = console.log }) {
  let last = 0, consecutiveFails = 0;
  return async function get(path, asText = false) {
    for (let attempt = 0; ; attempt++) {
      const wait = Math.max(0, last + delay - Date.now()); if (wait) await sleep(wait);
      last = Date.now();
      let r;
      try { r = await fetch(base + path, { headers: { 'User-Agent': UA, Accept: 'application/json,text/plain,*/*' } }); }
      catch (e) { if (attempt >= retries) throw new Error(`Network problem on ${path}: ${e.message}`); await sleep(1500 * (attempt + 1)); continue; }
      if (r.status === 403) throw new Blocked(`HTTP 403 on ${path}: the site is refusing us. Stopping and not retrying.`);
      if (r.status === 429 || r.status >= 500) {
        if (attempt >= retries) { consecutiveFails++; throw new Error(`HTTP ${r.status} on ${path} after ${retries} retries`); }
        const ra = Number(r.headers.get('retry-after')); await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 2000 * (attempt + 1) * (attempt + 1)); continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status} on ${path}`);
      consecutiveFails = 0;
      return asText ? r.text() : r.json();
    }
  };
}

const cents = (v) => (typeof v === 'number' && v > 0 ? Math.round(v * 100) : null);

export async function collect({ bulkPath, dataDir, base = 'https://tcgcsv.com', delay = 400, maxGroups = Infinity, today = null, log = console.log, fullPassEveryDays = 30 }) {
  const get = makeFetcher({ base, delay, log });
  mkdirSync(dataDir, { recursive: true });
  // the day these prices belong to: tcgcsv refreshes about 20:00 UTC, so a morning run reads yesterday evening's refresh
  let day;
  try { const t = (await get('/last-updated.txt', true)).trim(); const d = new Date(t); if (!isNaN(d)) day = dayIndex(d.toISOString().slice(0, 10)); } catch (e) { if (e instanceof Blocked) throw e; }
  if (day === undefined) { const n = new Date(today ? today + 'T12:00:00Z' : Date.now()); if (!today && n.getUTCHours() < 20) n.setUTCDate(n.getUTCDate() - 1); day = dayIndex(n.toISOString().slice(0, 10)); }
  const dayIso = isoFromDayIndex(day), runIso = today || new Date().toISOString().slice(0, 10);

  const prodMap = await buildProductMap(bulkPath);
  const statePath = join(dataDir, 'tcg-state.json'), groupsPath = join(dataDir, 'tcg-groups.json');
  let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
  if (state.priceDay !== dayIso) state = { priceDay: dayIso, done: [] };               // new data day: forget which files we fetched
  const known = existsSync(groupsPath) ? JSON.parse(readFileSync(groupsPath, 'utf8')) : { v: 1, fullPass: null, groups: {} };

  // 1. the list of Magic sets
  const gl = await get('/tcgplayer/1/groups'); const groups = gl.results || [];
  if (groups.length < 50) throw new Error(`Only ${groups.length} Magic sets listed; refusing to continue (the site may have changed).`);
  const upcoming = groups.filter(g => g.publishedOn && g.publishedOn.slice(0, 10) > runIso).map(g => ({ groupId: g.groupId, name: g.name, abbr: g.abbreviation || null, publishedOn: g.publishedOn.slice(0, 10) })).sort((a, b) => (a.publishedOn < b.publishedOn ? -1 : 1));
  writeFileSync(join(dataDir, 'catalysts.json'), JSON.stringify({ v: 1, day: dayIso, upcomingSets: upcoming }));

  // 2. which sets to ask for
  const fullDue = !known.fullPass || (dayIndex(runIso) - dayIndex(known.fullPass)) >= fullPassEveryDays;
  const todo = groups.filter(g => fullDue || !(String(g.groupId) in known.groups) || known.groups[g.groupId] > 0).map(g => g.groupId).filter(id => !state.done.includes(id)).slice(0, maxGroups);

  // 3. fetch prices, one set at a time
  const buffer = new Map();                                // scryfall id -> { key: cents }
  const stats = { day: dayIso, groupsListed: groups.length, groupsAsked: 0, groupsSkippedDone: state.done.length, products: 0, unmapped: 0, failed: 0, stoppedEarly: null, fullPass: fullDue };
  let consecutive = 0;
  for (const gid of todo) {
    let res;
    try { res = await get(`/tcgplayer/1/${gid}/prices`); }
    catch (e) {
      if (e instanceof Blocked) { stats.stoppedEarly = e.message; break; }
      stats.failed++; consecutive++; log(`  group ${gid}: ${e.message}`);
      if (consecutive >= 8) { stats.stoppedEarly = 'Too many failures in a row; stopping for today.'; break; }
      continue;
    }
    consecutive = 0; stats.groupsAsked++;
    let mapped = 0;
    for (const row of res.results || []) {
      const hit = prodMap.get(Number(row.productId)); if (!hit) { stats.unmapped++; continue; }
      mapped++; stats.products++;
      const o = buffer.get(hit.sid) || buffer.set(hit.sid, {}).get(hit.sid);
      const sub = String(row.subTypeName || '').toLowerCase();
      if (hit.etched) { const m = cents(row.marketPrice); if (m) o.qe = m; }
      else if (sub === 'normal') { const m = cents(row.marketPrice), l = cents(row.lowPrice); if (m) o.qn = m; if (l) o.ql = l; }
      else if (sub === 'foil') { const m = cents(row.marketPrice); if (m) o.qf = m; }
    }
    known.groups[gid] = mapped; state.done.push(gid);
    if (state.done.length % 25 === 0) writeFileSync(statePath, JSON.stringify(state));          // progress survives a crash
  }
  if (fullDue && !stats.stoppedEarly && stats.failed === 0 && groups.every(g => state.done.includes(g.groupId))) known.fullPass = runIso;   // only a COMPLETE pass counts

  // 4. write the day's prices onto the printings
  let printingsUpdated = 0;
  if (buffer.size) {
    for (let n = 0; n < SHARDS; n++) {
      const f = join(dataDir, shardFile(n)); if (!existsSync(f)) continue;
      const shard = JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')); let touched = false;
      for (const rec of Object.values(shard.cards)) for (const p of rec.p) {
        const inc = buffer.get(p.id); if (!inc) continue;
        for (const [k, v] of Object.entries(inc)) applyPoint((p.pr[k] ||= []), day, v);
        touched = true; printingsUpdated++; buffer.delete(p.id);
      }
      if (touched) writeFileSync(f, gzipSync(Buffer.from(JSON.stringify(shard)), { level: 9 }));
    }
  }
  stats.printingsUpdated = printingsUpdated; stats.noMatchInShards = buffer.size;
  writeFileSync(statePath, JSON.stringify(state)); writeFileSync(groupsPath, JSON.stringify(known));
  const idxPath = join(dataDir, 'index.json');
  if (existsSync(idxPath)) { const idx = JSON.parse(readFileSync(idxPath, 'utf8')); (idx.sources ||= {}).tcgplayer = { day: dayIso, groups: stats.groupsAsked, printings: printingsUpdated, series: ['qn', 'ql', 'qf', 'qe'] }; writeFileSync(idxPath, JSON.stringify(idx)); }
  return stats;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2); const flag = (n, d) => { const i = args.indexOf('--' + n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
  const base = flag('base', 'https://tcgcsv.com'), delay = Number(flag('delay', 400)), maxGroups = Number(flag('max-groups', Infinity));
  const [bulkPath, dataDir] = args;
  if (!bulkPath || !dataDir) { console.error('Usage: node pricescry-tcgplayer.mjs <scryfall-default-cards.jsonl[.gz]> <data-dir> [--base URL] [--delay ms] [--max-groups N]'); process.exit(1); }
  collect({ bulkPath, dataDir, base, delay, maxGroups }).then(s => { console.log('TCGplayer prices added:', JSON.stringify(s)); if (s.stoppedEarly) { console.error(s.stoppedEarly); process.exit(2); } })
    .catch(e => { console.error('Failed:', e.message); process.exit(1); });
}
