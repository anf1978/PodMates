// Proves the riser screen on fake markets with KNOWN rare breakouts planted in them.
// Run:  node pricescry-risers-selftest.mjs        (about a minute)
//
// What it checks:
//   A. The anatomy of past risers: breakouts concentrated where they were planted are visible as such,
//      and doublings with no event behind them are counted honestly as unexplained.
//   B. The screen, walking forward in time (each card scored using only what was known beforehand):
//      cards it shows really do double about as often as it claims, far more often than average.
//   C. A strict "more likely than not" gate (50%) shows nothing when the best situation doubles only
//      about one time in three (honest, not a bug), but shows real candidates when signals are stronger.
//   D. In a market where breakouts are random and nothing predicts them, the screen shows next to nothing.
//   E. Costs: a card that doubles but is too cheap to make ¥300 after Mercari costs is never shown.
// Real card prices are messier than this simulation, so passes mean "the method works", not "it will
// find real risers at these rates".

import { simulateMarket } from './pricescry-sim.mjs';
import { riserAnatomy, riserScreen, liveScreen, buildSamples, RISER_DEFAULTS } from './pricescry-risers.mjs';

let pass = 0, fail = 0;
const ck = (label, cond, extra = '') => { (cond ? pass++ : fail++); console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  -> ' + extra : '')); };
const SEEDS = [5, 15, 25, 35, 45];
const POCKETS = [
  { link: 'tribal_enabler', scarce: true, bands: ['cheap', 'mid'], p: 0.35, mult: 2.3 },
  { link: 'commander_staple', scarce: true, p: 0.20, mult: 2.2 },
];
// Two worlds: in the MODEST one the best situations double about 1 time in 3; in the STRONG one about 1 time in 2.
// Real markets could be either, or weaker than both; only real data can say.
const STRONG = [
  { link: 'tribal_enabler', scarce: true, bands: ['cheap', 'mid'], p: 0.60, mult: 2.3 },
  { link: 'commander_staple', scarce: true, p: 0.45, mult: 2.2 },
];
const mk = (seed, extra = {}) => simulateMarket({ seed, nEvents: 300, priceScale: 25, pockets: POCKETS, spikeRate: 0.00012, ...extra });
const mkStrong = (seed, extra = {}) => mk(seed, { pockets: STRONG, ...extra });
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const t0 = Date.now();

console.log('--- A. anatomy of past risers');
{
  let eps = 0, unexplained = 0, pocketDoubled = 0, pocketN = 0, otherDoubled = 0, otherN = 0;
  for (const seed of SEEDS) {
    const { src, events } = mk(seed);
    const an = riserAnatomy(src, events); eps += an.episodes; unexplained += (an.byLinkType.none || 0);
    for (const s of buildSamples(events, src, RISER_DEFAULTS)) {
      const inPocket = s.linkType === 'tribal_enabler' && s.scarce && s.pb <= 1;
      if (inPocket) { pocketN++; if (s.doubled) pocketDoubled++; } else { otherN++; if (s.doubled) otherDoubled++; }
    }
  }
  const pr = pocketDoubled / pocketN, orr = otherDoubled / otherN;
  ck(`doubling is far more common where it was planted: ${(100 * pr).toFixed(0)}% of scarce, cheap/mid tribal-enabler links doubled vs ${(100 * orr).toFixed(1)}% of all others`, pr >= 4 * orr);
  ck(`doublings with no event behind them are counted, not hidden: ${unexplained} of ${eps} episodes unexplained (${(100 * unexplained / eps).toFixed(0)}%)`, unexplained > 0 && unexplained < eps);
}

const GATE = RISER_DEFAULTS.pShow;     // one in three
console.log(`--- B. the screen at the default gate (${(100 * GATE).toFixed(0)}% chance of doubling or better)`);
const runWorld = (maker, opts, seeds = SEEDS) => { let shown = 0, dbl = 0, pred = 0, cons = 0, allD = 0;
  for (const seed of seeds) { const { src, events } = maker(seed); const r = riserScreen(events, src, opts);
    for (const x of r.rows) { cons++; if (x.doubled) allD++; if (x.shown) { shown++; if (x.doubled) dbl++; pred += x.P; } } }
  return { shown, dbl, cons, allD, rate: shown ? dbl / shown : null, claim: shown ? pred / shown : null, base: allD / cons }; };
{
  const w = runWorld(mkStrong, {});
  ck(`strong signals: ${w.shown} cards shown, ${(100 * w.rate).toFixed(0)}% of them doubled (claimed ${(100 * w.claim).toFixed(0)}%, average card ${(100 * w.base).toFixed(1)}%)`, w.shown >= 100 && w.rate >= GATE - 0.03 && w.rate >= 3 * w.base && Math.abs(w.claim - w.rate) <= 0.08);
  const m = runWorld(mk, {}, [5, 15, 25, 35, 45, 55, 65, 75]);
  ck(`modest signals (best situation about 30%): the gate is rarely met, so only ${m.shown} cards shown out of ${m.cons}; those doubled ${m.shown ? (100 * m.rate).toFixed(0) + '%' : 'n/a'} (claimed ${m.shown ? (100 * m.claim).toFixed(0) + '%' : 'n/a'})`, m.shown < 0.01 * m.cons && (m.shown === 0 || (m.rate >= 3 * m.base && Math.abs(m.claim - m.rate) <= 0.10)));
  ck(`modest signals: it catches only part of the risers (${(100 * m.dbl / m.allD).toFixed(0)}% of all doublings); the rest are not predictable from events`, m.dbl / m.allD < 0.6);
  console.log(`   (with strong signals it catches ${(100 * w.dbl / w.allD).toFixed(0)}% of all doublings)`);
}

console.log('--- C. a strict "more likely than not" gate (50%)');
{
  const m = runWorld(mk, { pShow: 0.5 });
  ck(`modest signals: shows nothing, because even the best situation doubles only about 1 time in 3 (${m.shown} shown)`, m.shown <= 2);
  const s = runWorld(mkStrong, { pShow: 0.5 });
  ck(`strong signals: ${s.shown} shown, and ${(100 * s.rate).toFixed(0)}% of them did double (claimed ${(100 * s.claim).toFixed(0)}%)`, s.shown >= 5 && s.rate >= 0.40);
  console.log('   So whether a 50% gate is usable depends entirely on how strong the real patterns turn out to be.');
}

console.log('--- D. random breakouts that nothing predicts');
{ let n = 0, c = 0; for (const seed of SEEDS) { const { src, events } = mk(seed, { pockets: null, baselineBreakout: 0.06 }); const r = riserScreen(events, src, {}); n += r.rows.filter(x => x.shown).length; c += r.rows.length; }
  ck(`the screen stays almost empty: ${n} shown out of ${c} considered`, n <= 5); }

console.log('--- E. costs: a doubling is worthless if the card is too cheap to profit');
{ let n = 0, below = 0, cheapLikely = 0, dear = 0;
  for (const seed of SEEDS.slice(0, 3)) {
    const c = riserScreen(...(([m]) => [m.events, m.src])([mkStrong(seed, { priceScale: 1 })]), {}); const d = riserScreen(...(([m]) => [m.events, m.src])([mkStrong(seed)]), {});
    for (const x of c.rows) { if (x.shown) { n++; if (x.netYenIfDoubled < 300) below++; } if (x.P >= GATE && x.netYenIfDoubled < 300) cheapLikely++; }
    dear += d.rows.filter(x => x.shown).length;
  }
  ck(`no card is ever shown unless it would still make 300 yen after Mercari costs when it only just doubles (${below} breaches)`, below === 0, `${n} shown in a cheap-card market`);
  ck(`${cheapLikely} cards looked likely to double but were held back for being too cheap to profit`, cheapLikely > 0);
  ck(`far fewer are shown in the cheap market (${n}) than in the dearer one (${dear}): under a third as many`, n * 3 < dear); }

console.log('--- F. (information) what the screen would have shown, one market');
{ const { src, events } = mk(5); const r = riserScreen(events, src, {}); const sm = r.summary;
  console.log(`   considered ${sm.considered}, shown ${sm.shown}; base rate ${(100 * sm.baseRate).toFixed(1)}%, shown doubled ${(100 * sm.shownRate).toFixed(0)}%, lift ${sm.lift.toFixed(1)}x`);
  for (const b of sm.calibration) console.log(`   given ${b.range}: n=${b.n}, claimed ${b.predicted == null ? '-' : (100 * b.predicted).toFixed(0) + '%'}, realised ${b.realized == null ? '-' : (100 * b.realized).toFixed(0) + '%'}`); }
console.log('--- G. the live screen scores brand-new events using only what had already played out');
{ let shown = 0, hit = 0, leak = 0, bad = 0;
  for (const seed of SEEDS) {
    const { src, events } = mkStrong(seed); const cutoff = 700;
    const past = events.filter(e => e.day + 14 <= cutoff), fresh = events.filter(e => e.day > cutoff && e.day <= 800);
    const trimmed = { ...src, maxDay: cutoff };                       // the screen can only see prices up to the cutoff
    const r = liveScreen(past, fresh.map(e => ({ ...e, day: Math.min(e.day, cutoff + 1) })), trimmed, {});
    if (r.rows.some(x => x.shown && x.P < GATE)) bad++;
    // check the shown ones against what really happened afterwards (using the full market)
    for (const x of r.rows.filter(x => x.shown)) { shown++; const real = src.price(x.card, cutoff + 14); const p0 = src.price(x.card, cutoff); if (real && p0 && real / p0 >= 2) hit++; }
    leak += r.trainSamples > 0 && r.rows.length === 0 && r.note ? 1 : 0;
  }
  ck('nothing below the gate is ever shown by the live screen, and with strong signals it does show candidates', bad === 0 && shown > 0, `${shown} cards shown across ${SEEDS.length} markets`);
  ck('with no history at all the live screen says so and shows nothing', (() => { const { src, events } = mk(5); const r = liveScreen([], events.slice(0, 3), src, {}); return r.rows.length === 0 && /nothing can be judged/.test(r.note); })()); }

console.log(`\n${pass} passed, ${fail} failed  (${((Date.now() - t0) / 1000).toFixed(0)} seconds)`);
if (fail) process.exit(1);
