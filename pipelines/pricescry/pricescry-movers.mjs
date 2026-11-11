// PriceScry movers, from ALL shops.
// Usage: node pricescry-movers.mjs <data-dir>
//
// Recomputes <data-dir>/movers.json from the consensus price (the middle price across TCGplayer, Cardmarket, Card Kingdom and
// Manapool; see pricescry-lib.mjs) instead of Scryfall alone. A card is listed as a riser or faller only if at least TWO
// shops show the same move on the same printing, so one shop's thin-stock spike or a stale listing cannot put a card on the
// list. Each row says how many shops confirm it. Run it after the MTGJSON prices have been added.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join } from 'path';
import { dayIndex, isoFromDayIndex, consensusAt, sourceValuesAt, makeEurUsd, hasMjSeries, firstDayAnySource } from './pricescry-lib.mjs';

const WINDOWS = [7, 30], MIN_CENTS = 200, PER_LIST = 40, MIN_SHOPS = 2;

export function computeMovers(dataDir) {
  const idx = JSON.parse(readFileSync(join(dataDir, 'index.json'), 'utf8'));
  const day = dayIndex(idx.day);
  const fxFile = join(dataDir, 'fx.json');
  const eurUsd = makeEurUsd(existsSync(fxFile) ? JSON.parse(readFileSync(fxFile, 'utf8')) : null);
  const rows = Object.fromEntries(WINDOWS.map(w => [w, []])); let cards = 0, noShopData = 0, unconfirmed = 0;
  for (const f of readdirSync(join(dataDir, 'cards'))) {
    if (!f.endsWith('.json.gz')) continue;
    const shard = JSON.parse(gunzipSync(readFileSync(join(dataDir, 'cards', f))).toString('utf8'));
    for (const [key, rec] of Object.entries(shard.cards)) {
      if (!hasMjSeries(rec)) { noShopData++; continue; }       // only cards the shops have priced can be confirmed
      const now = consensusAt(rec, day, eurUsd); if (!now || now.price < MIN_CENTS) continue;
      cards++;
      const first = firstDayAnySource(rec);
      for (const w of WINDOWS) {
        if (first === undefined || first > day - w) continue;  // not enough history for this window yet
        const then = consensusAt(rec, day - w, eurUsd); if (!then || then.price < MIN_CENTS) continue;
        // per-shop change on the SAME printing and finish that is the card's cheapest now
        const before = Object.fromEntries(sourceValuesAt(now.printing, now.finish, day - w, eurUsd).map(v => [v.src, v.cents]));
        const changes = now.sources.filter(v => before[v.src] > 0).map(v => (v.cents - before[v.src]) / before[v.src]);
        const pct = (now.price - then.price) / then.price;
        const confirm = changes.filter(c => Math.sign(c) === Math.sign(pct) && Math.abs(c) >= Math.abs(pct) * 0.5).length;
        if (changes.length < MIN_SHOPS || confirm < MIN_SHOPS) { if (Math.abs(pct) >= 0.2) unconfirmed++; continue; }
        rows[w].push({ k: key, n: rec.n, now: now.price, then: then.price, pct: Math.round(pct * 1000) / 10, shops: confirm, of: changes.length });
      }
    }
  }
  const windows = {};
  for (const w of WINDOWS) windows[w] = {
    up: rows[w].filter(r => r.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, PER_LIST),
    down: rows[w].filter(r => r.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, PER_LIST),
    considered: rows[w].length,
  };
  const out = { v: 2, day: isoFromDayIndex(day), basis: 'consensus of shops, confirmed by at least two', minUsdCents: MIN_CENTS, windows };
  writeFileSync(join(dataDir, 'movers.json'), JSON.stringify(out));
  return { cards, noShopData, unconfirmedMoves: unconfirmed, up7: windows[7].up.length, down7: windows[7].down.length, considered7: windows[7].considered };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dataDir = process.argv[2];
  if (!dataDir) { console.error('Usage: node pricescry-movers.mjs <data-dir>'); process.exit(1); }
  try { console.log('Movers recomputed from all shops:', computeMovers(dataDir)); } catch (e) { console.error('Movers failed:', e.message); process.exit(1); }
}
