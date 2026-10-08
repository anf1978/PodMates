// Keeps <data-dir>/fx.json up to date: daily yen rates for USD and EUR.
// Usage: node pricescry-fx.mjs <data-dir>
//
// Source: Frankfurter (free, no key; reference rates from central banks, published on
// business days). The page uses the nearest earlier rate for weekends and holidays.
// The first run back-fills from 2020 so older prices can be shown in yen too.
//
// UNVERIFIED FROM THE DEVELOPMENT SANDBOX (it cannot reach the internet): confirm the first
// real run logs "FX updated". Two URL styles are tried because Frankfurter has moved hosts.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { dayIndex, isoFromDayIndex, todayIso, applyPoint } from './pricescry-lib.mjs';

const UA = 'PodMatesPriceScry/1.0 (+https://github.com/anf1978/PodMates)';
const BASES = ['https://api.frankfurter.dev/v1', 'https://api.frankfurter.app'];

async function getJson(path) {
  let lastErr;
  for (const base of BASES) {
    try {
      const r = await fetch(base + path, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (r.ok) return await r.json();
      lastErr = new Error(`${base}${path} -> HTTP ${r.status}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// EUR is the base because that is what the source publishes; USD->JPY is derived from it.
export function ratesToPoints(rates, fxSeries) {
  for (const date of Object.keys(rates).sort()) {
    const r = rates[date];
    if (!r || !r.JPY || !r.USD) continue;
    const d = dayIndex(date);
    applyPoint(fxSeries.eurjpy, d, Math.round(r.JPY * 10000));
    applyPoint(fxSeries.usdjpy, d, Math.round((r.JPY / r.USD) * 10000));
  }
}

export async function updateFx(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, 'fx.json');
  const fx = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { v: 1, pairs: { usdjpy: [], eurjpy: [] } };
  const haveHistory = fx.pairs.eurjpy.length > 30;
  const from = haveHistory ? isoFromDayIndex(fx.pairs.eurjpy[fx.pairs.eurjpy.length - 1][0] - 5) : '2020-01-01';
  const data = await getJson(`/${from}..?base=EUR&symbols=JPY,USD`);
  if (!data.rates || !Object.keys(data.rates).length) throw new Error('FX response had no rates');
  ratesToPoints(data.rates, fx.pairs);
  writeFileSync(file, JSON.stringify(fx));
  const lastEur = fx.pairs.eurjpy[fx.pairs.eurjpy.length - 1], lastUsd = fx.pairs.usdjpy[fx.pairs.usdjpy.length - 1];
  const idxPath = join(dataDir, 'index.json');
  if (existsSync(idxPath)) {
    const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
    idx.fx = { day: isoFromDayIndex(lastUsd[0]), usdjpy: lastUsd[1] / 10000, eurjpy: lastEur[1] / 10000 };
    writeFileSync(idxPath, JSON.stringify(idx));
  }
  return { from, points: fx.pairs.eurjpy.length, usdjpy: lastUsd[1] / 10000, eurjpy: lastEur[1] / 10000 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dataDir = process.argv[2];
  if (!dataDir) { console.error('Usage: node pricescry-fx.mjs <data-dir>'); process.exit(1); }
  updateFx(dataDir).then(s => console.log('FX updated:', s)).catch(e => { console.error('FX update failed:', e.message); process.exit(1); });
}
