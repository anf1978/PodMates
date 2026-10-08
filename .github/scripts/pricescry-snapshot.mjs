// PriceScry daily snapshot.
//
// Usage: node pricescry-snapshot.mjs <scryfall-default-cards.json[.gz]> <data-dir> [YYYY-MM-DD]
//
// Reads Scryfall's "default_cards" bulk file (every printing, with prices), adds today's
// prices to the history files in <data-dir>, and rebuilds index.json and movers.json.
// Safe to run twice in one day (the second run just overwrites that day's values).
//
// Scryfall only updates prices once a day, so running more often gains nothing.

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { createGunzip } from 'zlib';
import { dirname, join } from 'path';
import { gzipSync, gunzipSync } from 'zlib';
import {
  SHARDS, dayIndex, isoFromDayIndex, todayIso, nameKey, shardOf, shardFile,
  updatePrinting, marketUsdAt, firstPriceDay, applyPoint,
  SIGNAL_FORMATS, LEGAL_CODE, RANK_JUMP, SIGNAL_KEEP_DAYS,
} from './pricescry-lib.mjs';

const MIN_PLAUSIBLE_PRINTINGS = 40000;   // the real file has well over 100,000
const SKIP_LAYOUTS = new Set(['token', 'double_faced_token', 'emblem', 'art_series']);
const MOVER_WINDOWS = [7, 30];
const MOVER_MIN_USD_CENTS = 200;         // ignore pennies: a 50% move on 20 cents is noise
const MOVERS_PER_LIST = 40;

async function* readCards(path) {
  const head = readFileSync(path, { encoding: null }).subarray(0, 2);
  const isGz = head[0] === 0x1f && head[1] === 0x8b;
  const input = isGz ? createReadStream(path).pipe(createGunzip()) : createReadStream(path);
  const rl = createInterface({ input, crlfDelay: Infinity });
  for await (const raw of rl) {
    const line = raw.trim().replace(/,$/, '');
    if (!line || line === '[' || line === ']') continue;
    let card; try { card = JSON.parse(line); } catch { continue; }
    if (card && card.object === 'card') yield card;
  }
}

function loadShard(dataDir, n) {
  const f = join(dataDir, shardFile(n));
  if (!existsSync(f)) return { v: 1, shard: n, cards: {} };
  return JSON.parse(gunzipSync(readFileSync(f)).toString('utf8'));
}
function saveShard(dataDir, n, obj) {
  const f = join(dataDir, shardFile(n));
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 }));
}

export async function runSnapshot({ bulkPath, dataDir, dayIso }) {
  const day = dayIndex(dayIso || todayIso());
  mkdirSync(dataDir, { recursive: true });

  // 1. Group today's printings by card (name), then by shard
  const byKey = new Map();
  let printings = 0;
  for await (const c of readCards(bulkPath)) {
    if (SKIP_LAYOUTS.has(c.layout)) continue;
    if (Array.isArray(c.games) && !c.games.includes('paper')) continue;   // Arena/MTGO-only cards are not buyable cards
    const key = nameKey(c.name);
    let g = byKey.get(key);
    if (!g) { g = { name: c.name, reserved: !!c.reserved, edhrec: c.edhrec_rank ?? null, gc: !!c.game_changer, legal: c.legalities || null, list: [] }; byKey.set(key, g); }
    g.list.push(c); printings++;
  }
  if (printings < MIN_PLAUSIBLE_PRINTINGS) {
    throw new Error(`Only ${printings} paper printings found, expected at least ${MIN_PLAUSIBLE_PRINTINGS}. Refusing to write anything.`);
  }
  const byShard = new Map();
  for (const [key, g] of byKey) { const s = shardOf(key); if (!byShard.has(s)) byShard.set(s, []); byShard.get(s).push([key, g]); }

  // 2. Merge into the history files, one shard at a time (memory stays small)
  const moverRows = Object.fromEntries(MOVER_WINDOWS.map(w => [w, []]));
  let newPoints = 0;
  // Signals are only reported as events once there is a yesterday to compare with (the first run just records the starting point).
  const idxPath0 = join(dataDir, 'index.json');
  const haveYesterday = existsSync(idxPath0);
  const events = [];
  for (const [n, entries] of byShard) {
    const shard = loadShard(dataDir, n);
    for (const [key, g] of entries) {
      const isNewCard = !shard.cards[key];
      const rec = shard.cards[key] || { n: g.name, p: [] };
      const prevEr = rec.er, prevGc = rec.gc;
      rec.n = g.name; rec.rs = g.reserved ? 1 : 0; rec.er = g.edhrec; rec.gc = g.gc ? 1 : 0;
      // series that change rarely: EDHREC rank, Game Changer flag, and legality in each format
      rec.ers = rec.ers || []; applyPoint(rec.ers, day, g.edhrec == null ? null : g.edhrec);
      rec.gcs = rec.gcs || []; applyPoint(rec.gcs, day, g.gc ? 1 : 0);
      rec.lg = rec.lg || {};
      for (const f of SIGNAL_FORMATS) {
        const code = g.legal && LEGAL_CODE[g.legal[f]]; if (!code) continue;
        const ser = (rec.lg[f] = rec.lg[f] || []), last = ser.length ? ser[ser.length - 1][1] : null;
        applyPoint(ser, day, code);
        if (haveYesterday && last && last !== code) events.push({ day, type: 'legality', k: key, n: g.name, format: f, from: last, to: code });
      }
      if (haveYesterday && prevGc !== undefined && prevGc !== (g.gc ? 1 : 0)) events.push({ day, type: 'game_changer', k: key, n: g.name, to: g.gc ? 1 : 0 });
      if (haveYesterday && typeof prevEr === 'number' && typeof g.edhrec === 'number' && g.edhrec <= prevEr * RANK_JUMP.ratio && prevEr - g.edhrec >= RANK_JUMP.minGain) events.push({ day, type: 'rank_jump', k: key, n: g.name, from: prevEr, to: g.edhrec });
      if (haveYesterday && isNewCard) { const s0 = g.list[0]; events.push({ day, type: 'new_card', k: key, n: g.name, set: s0.set, setName: s0.set_name, releases: s0.released_at, preview: s0.preview && s0.preview.previewed_at ? { d: s0.preview.previewed_at, s: s0.preview.source || null } : null }); }
      const byId = new Map(rec.p.map(p => [p.id, p]));
      for (const src of g.list) {
        const before = byId.get(src.id);
        if (haveYesterday && !before && !isNewCard) events.push({ day, type: 'new_printing', k: key, n: g.name, set: src.set, setName: src.set_name, releases: src.released_at, rarity: src.rarity });
        const sizeBefore = before ? Object.values(before.pr).reduce((a, s) => a + s.length, 0) : 0;
        const upd = updatePrinting(before, src, day);
        byId.set(src.id, upd);
        newPoints += Object.values(upd.pr).reduce((a, s) => a + s.length, 0) - sizeBefore;
      }
      rec.p = [...byId.values()].sort((a, b) => (a.r < b.r ? -1 : a.r > b.r ? 1 : 0));
      shard.cards[key] = rec;
      // movers: compare today's market price with the price `w` days ago
      const now = marketUsdAt(rec, day), first = firstPriceDay(rec);
      if (now !== undefined && now >= MOVER_MIN_USD_CENTS && first !== undefined) {
        for (const w of MOVER_WINDOWS) {
          if (first > day - w) continue;                   // not enough history yet
          const then = marketUsdAt(rec, day - w);
          if (then === undefined || then < MOVER_MIN_USD_CENTS) continue;
          moverRows[w].push({ k: key, n: rec.n, now, then, pct: Math.round(((now - then) / then) * 1000) / 10 });
        }
      }
    }
    saveShard(dataDir, n, shard);
  }

  // 3. Movers + index
  const windows = {};
  for (const w of MOVER_WINDOWS) {
    const rows = moverRows[w];
    windows[w] = {
      up: rows.filter(r => r.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, MOVERS_PER_LIST),
      down: rows.filter(r => r.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, MOVERS_PER_LIST),
      considered: rows.length,
    };
  }
  writeFileSync(join(dataDir, 'movers.json'), JSON.stringify({ v: 1, day: isoFromDayIndex(day), minUsdCents: MOVER_MIN_USD_CENTS, windows }));

  // the running log of signal events: appended each day, never duplicated, trimmed to the last year or so
  const sigFile = join(dataDir, 'signals.json.gz');
  let log = existsSync(sigFile) ? JSON.parse(gunzipSync(readFileSync(sigFile)).toString('utf8')) : [];
  const seen = new Set(log.map(e => [e.day, e.type, e.k, e.format || '', e.set || '', e.to ?? ''].join('|')));
  let added = 0;
  for (const e of events) { const id = [e.day, e.type, e.k, e.format || '', e.set || '', e.to ?? ''].join('|'); if (!seen.has(id)) { log.push(e); seen.add(id); added++; } }
  log = log.filter(e => e.day >= day - SIGNAL_KEEP_DAYS);
  writeFileSync(sigFile, gzipSync(Buffer.from(JSON.stringify(log)), { level: 9 }));
  const idxPath = join(dataDir, 'index.json');
  const prev = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, 'utf8')) : null;
  const index = {
    v: 1, day: isoFromDayIndex(day), generated: new Date().toISOString(),
    firstDay: prev && prev.firstDay ? prev.firstDay : isoFromDayIndex(day),
    cards: byKey.size, printings, shards: SHARDS,
    sources: { scryfall: { note: 'TCGplayer USD, Cardmarket EUR, MTGO tix; updated once a day by Scryfall' } },
    fx: prev && prev.fx ? prev.fx : null,
    signals: { events: log.length, newToday: added, last: isoFromDayIndex(day) },
  };
  writeFileSync(idxPath, JSON.stringify(index));
  return { day: index.day, cards: index.cards, printings, shardsWritten: byShard.size, newPoints, moversConsidered: windows[7].considered, signalsToday: added };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , bulkPath, dataDir, dayArg] = process.argv;
  if (!bulkPath || !dataDir) { console.error('Usage: node pricescry-snapshot.mjs <bulk.json[.gz]> <data-dir> [YYYY-MM-DD]'); process.exit(1); }
  runSnapshot({ bulkPath, dataDir, dayIso: dayArg }).then(s => console.log('Snapshot complete:', s)).catch(e => { console.error('Snapshot failed:', e.message); process.exit(1); });
}
