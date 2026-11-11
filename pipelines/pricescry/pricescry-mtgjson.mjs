// PriceScry: bring MTGJSON's multi-shop prices into the price history.
//
// MTGJSON publishes, for every printing, daily prices from several shops: TCGplayer, Cardmarket, Card Kingdom
// (retail AND buylist) and Manapool. It keeps only about 90 days of history, but that is far more than we
// can collect ourselves in a first run, so this script back-fills it and keeps it current.
//
// Three commands:
//   node pricescry-mtgjson.mjs peek <file.json[.gz]>
//        Shows the structure of an MTGJSON file (first few entries) and writes nothing. Use it first on a new
//        file to confirm it looks the way this script expects.
//   node pricescry-mtgjson.mjs build-map <AllIdentifiers.json[.gz]> <data-dir>
//        Builds <data-dir>/uuidmap.json.gz, the link from MTGJSON's card id (uuid) to Scryfall's card id,
//        which is how our price files identify a printing.
//   node pricescry-mtgjson.mjs prices <AllPrices.json[.gz] | AllPricesToday.json.gz> <data-dir>
//        Adds those prices to every matching printing in <data-dir>/cards/*.json.gz. Run it with the big
//        AllPrices file once (the back-fill), then with the small AllPricesToday file every day.
//
// The big files are read as a stream, a card at a time, because AllPrices is several hundred megabytes of
// text once unzipped and will not fit in memory as one piece. Needs nothing installed (it reads the bytes itself).
//
// What it does to the prices
//   - stores them as change points under the keys described in pricescry-lib.mjs (mjKey);
//   - drops obviously bad prices (see guardRetail) and reports how many;
//   - rounds to whole cents (some source values carry 16 decimal places of floating-point noise);
//   - replaces our stored points inside the file's date window and keeps everything older, so history grows
//     each time instead of being overwritten.

import { createReadStream, existsSync, mkdirSync, openSync, readSync, closeSync, readFileSync, writeFileSync } from 'fs';
import { createGunzip, gunzipSync, gzipSync } from 'zlib';
import { join } from 'path';
import { dayIndex, isoFromDayIndex, applyPoint, shardFile, SHARDS, mjKey, guardRetail } from './pricescry-lib.mjs';

function readHead(file, n) {                     // only the first n bytes: the big files must never be loaded whole
  const fd = openSync(file, 'r'); const buf = Buffer.alloc(n);
  try { const got = readSync(fd, buf, 0, n, 0); return buf.subarray(0, got); } finally { closeSync(fd); }
}
// Fast reader for MTGJSON's big files. The generic streaming parser was too slow on the 4 GB price file, so this
// walks the bytes itself: it finds the "data" object, then cuts out one entry (one card) at a time by counting
// braces (aware of quoted text) and parses just that entry. Memory stays at one card plus one 1 MB chunk.
export async function* streamEntries(file, path = 'data') {
  const raw = createReadStream(file, { highWaterMark: 1 << 20 });
  const head = readHead(file, 2);
  const src = head[0] === 0x1f && head[1] === 0x8b ? raw.pipe(createGunzip()) : raw;
  const want = Buffer.from('"' + path + '"');
  let buf = Buffer.alloc(0), pos = 0;
  let state = 'find';                            // find -> (after "data") colon/open -> entries
  const Q = 34, BS = 92, LB = 123, RB = 125, COMMA = 44, COLON = 58;
  const isWs = c => c === 32 || c === 10 || c === 13 || c === 9;
  for await (const chunk of src) {
    buf = pos >= buf.length ? chunk : Buffer.concat([buf.subarray(pos), chunk]); pos = 0;
    for (;;) {
      if (state === 'find') {
        const i = buf.indexOf(want, pos);
        if (i < 0) { pos = Math.max(pos, buf.length - want.length); break; }
        let j = i + want.length; while (j < buf.length && (isWs(buf[j]) || buf[j] === COLON)) j++;
        if (j >= buf.length) { pos = i; break; }
        if (buf[j] !== LB) { pos = j; continue; }       // a "data" string that is not the data object
        pos = j + 1; state = 'key';
      }
      // skip separators, read a key
      while (pos < buf.length && (isWs(buf[pos]) || buf[pos] === COMMA)) pos++;
      if (pos >= buf.length) break;
      if (buf[pos] === RB) return;                       // end of data
      if (buf[pos] !== Q) throw new Error('Unexpected byte in the file near an entry key.');
      let k = pos + 1; while (k < buf.length && buf[k] !== Q) k += (buf[k] === BS ? 2 : 1);
      if (k >= buf.length) break;                        // key not complete yet: wait for more bytes
      let c = k + 1; while (c < buf.length && (isWs(buf[c]) || buf[c] === COLON)) c++;
      if (c >= buf.length) break;
      if (buf[c] !== LB) throw new Error('An entry value is not an object.');
      // find the matching close brace
      let depth = 0, inStr = false, e = c, done = false;
      for (; e < buf.length; e++) {
        const b = buf[e];
        if (inStr) { if (b === BS) e++; else if (b === Q) inStr = false; }
        else if (b === Q) inStr = true;
        else if (b === LB) depth++;
        else if (b === RB && --depth === 0) { done = true; break; }
      }
      if (!done) break;                                  // entry incomplete: wait for more bytes
      const key = JSON.parse(buf.toString('utf8', pos, k + 1));
      yield { key, value: JSON.parse(buf.toString('utf8', c, e + 1)) };
      pos = e + 1;
    }
  }
}
function readMeta(file) {                       // the "meta" block sits at the top of the file; read just enough to find it
  const buf = readHead(file, 400000);
  const text = (buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf, { finishFlush: 2 }) : buf).toString('utf8');
  const m = text.match(/"meta"\s*:\s*(\{[^}]*\})/);
  return m ? JSON.parse(m[1]) : null;
}

// ---- peek ----------------------------------------------------------------------------
export async function peek(file, count = 2) {
  console.log('meta:', JSON.stringify(readMeta(file)));
  let n = 0;
  for await (const { key, value } of streamEntries(file, 'data')) {
    console.log('entry', key, JSON.stringify(value).slice(0, 700));
    if (++n >= count) break;
  }
}

// ---- uuid -> Scryfall id ---------------------------------------------------------------
export async function buildMap(identifiersFile, dataDir) {
  const map = {}; let seen = 0, mapped = 0;
  for await (const { key, value } of streamEntries(identifiersFile, 'data')) {
    seen++;
    const sid = value && value.identifiers && value.identifiers.scryfallId;
    if (sid) { map[key] = sid; mapped++; }
  }
  if (!seen) throw new Error('No entries found under "data" in the identifiers file.');
  if (mapped < seen * 0.5) throw new Error(`Only ${mapped} of ${seen} entries had identifiers.scryfallId, so the file is not laid out as expected. Run "peek" on it and check.`);
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'uuidmap.json.gz'), gzipSync(Buffer.from(JSON.stringify({ v: 1, built: new Date().toISOString(), map })), { level: 9 }));
  return { entries: seen, mapped };
}

// ---- prices ---------------------------------------------------------------------------
export async function addPrices(pricesFile, dataDir, opts = {}) {
  const mapFile = join(dataDir, 'uuidmap.json.gz');
  if (!existsSync(mapFile)) throw new Error('No uuidmap.json.gz in the data folder. Run "build-map" first.');
  const map = JSON.parse(gunzipSync(readFileSync(mapFile)).toString('utf8')).map;
  let eurUsd = 1.1;
  const fxFile = join(dataDir, 'fx.json');
  if (existsSync(fxFile)) { const fx = JSON.parse(readFileSync(fxFile, 'utf8')).pairs; if (fx.usdjpy.length && fx.eurjpy.length) eurUsd = fx.eurjpy[fx.eurjpy.length - 1][1] / fx.usdjpy[fx.usdjpy.length - 1][1]; }
  const meta = readMeta(pricesFile);

  // 1. read the stream: one card (uuid) at a time -> change-point series per printing
  const agg = new Map();                          // scryfall id -> { key: [[day, cents], ...] }
  const stats = { uuids: 0, unmapped: 0, dropped: {}, points: 0, minDay: Infinity, maxDay: -Infinity, collisions: 0 };
  for await (const { key: uuid, value: rec } of streamEntries(pricesFile, 'data')) {
    stats.uuids++;
    const sid = map[uuid];
    if (!sid) { stats.unmapped++; continue; }
    const paper = (rec && rec.paper) || {};
    // collect: finish -> date -> provider -> price (retail), so the guard can compare shops on the same day
    const retail = {};
    for (const [prov, body] of Object.entries(paper)) {
      for (const [finish, series] of Object.entries((body && body.retail) || {})) for (const [date, v] of Object.entries(series)) {
        if (typeof v !== 'number' || !(v > 0)) continue;
        ((retail[finish] ||= {})[date] ||= {})[prov] = v;
      }
    }
    const out = {};
    const put = (k, date, v) => { const day = dayIndex(date); if (day < stats.minDay) stats.minDay = day; if (day > stats.maxDay) stats.maxDay = day; (out[k] ||= []).push([day, Math.round(v * 100)]); };
    for (const [finish, byDate] of Object.entries(retail)) for (const [date, provs] of Object.entries(byDate)) {
      const drop = new Set(guardRetail(provs, eurUsd));
      for (const [prov, v] of Object.entries(provs)) {
        if (drop.has(prov)) { stats.dropped[prov] = (stats.dropped[prov] || 0) + 1; continue; }
        const k = mjKey(prov, 'retail', finish); if (k) put(k, date, v);
      }
    }
    for (const [prov, body] of Object.entries(paper)) {          // buylists: only Card Kingdom has one; no cross-check possible
      for (const [finish, series] of Object.entries((body && body.buylist) || {})) for (const [date, v] of Object.entries(series)) {
        if (typeof v !== 'number' || !(v > 0)) continue;
        const k = mjKey(prov, 'buylist', finish); if (k) put(k, date, v);
      }
    }
    const compact = {};
    for (const [k, pts] of Object.entries(out)) { pts.sort((a, b) => a[0] - b[0]); const s = []; for (const [d, v] of pts) applyPoint(s, d, v); if (s.length) compact[k] = s; }
    if (Object.keys(compact).length) { if (agg.has(sid)) stats.collisions++; else agg.set(sid, compact); }
  }
  if (!stats.uuids) throw new Error('No entries read from the prices file.');
  if (stats.unmapped > stats.uuids * 0.5) throw new Error(`${stats.unmapped} of ${stats.uuids} cards had no Scryfall match in uuidmap.json.gz. Rebuild the map with "build-map" and try again.`);
  const windowStart = stats.minDay;

  // 2. merge into the shard files, one shard at a time
  let printingsUpdated = 0, pointsKept = 0;
  for (let n = 0; n < SHARDS; n++) {
    const f = join(dataDir, shardFile(n));
    if (!existsSync(f)) continue;
    const shard = JSON.parse(gunzipSync(readFileSync(f)).toString('utf8'));
    let touched = false;
    for (const rec of Object.values(shard.cards)) for (const p of rec.p) {
      const inc = agg.get(p.id); if (!inc) continue;
      for (const [k, incoming] of Object.entries(inc)) {
        const kept = (p.pr[k] || []).filter(([d]) => d < windowStart);   // older history stays; the file's window is replaced
        pointsKept += kept.length;
        for (const [d, v] of incoming) applyPoint(kept, d, v);
        p.pr[k] = kept;
      }
      agg.delete(p.id); printingsUpdated++; touched = true;
    }
    if (touched) writeFileSync(f, gzipSync(Buffer.from(JSON.stringify(shard)), { level: 9 }));
  }

  // 3. record it in index.json
  const idxPath = join(dataDir, 'index.json');
  if (existsSync(idxPath)) {
    const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
    idx.sources = idx.sources || {};
    idx.sources.mtgjson = { version: meta && meta.version, date: meta && meta.date, windowFrom: isoFromDayIndex(stats.minDay), windowTo: isoFromDayIndex(stats.maxDay), providers: ['tcgplayer', 'cardmarket', 'cardkingdom (retail + buylist)', 'manapool'] };
    writeFileSync(idxPath, JSON.stringify(idx));
  }
  return { cards: stats.uuids, unmapped: stats.unmapped, noMatchInShards: agg.size, printingsUpdated, dropped: stats.dropped, collisions: stats.collisions, window: `${isoFromDayIndex(stats.minDay)}..${isoFromDayIndex(stats.maxDay)}`, olderPointsKept: pointsKept };
}

// ---- CLI ---------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , cmd, a, b] = process.argv;
  const usage = () => { console.error('Usage:\n  node pricescry-mtgjson.mjs peek <file>\n  node pricescry-mtgjson.mjs build-map <AllIdentifiers.json[.gz]> <data-dir>\n  node pricescry-mtgjson.mjs prices <AllPrices.json[.gz]|AllPricesToday.json.gz> <data-dir>'); process.exit(1); };
  const run = async () => {
    if (cmd === 'peek' && a) return peek(a);
    if (cmd === 'build-map' && a && b) return console.log('Map built:', await buildMap(a, b));
    if (cmd === 'prices' && a && b) return console.log('MTGJSON prices added:', await addPrices(a, b));
    usage();
  };
  run().catch(e => { console.error('Failed:', e.message); process.exit(1); });
}
