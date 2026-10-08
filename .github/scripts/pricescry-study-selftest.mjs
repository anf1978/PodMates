// Proves the PriceScry study engine works BEFORE it ever sees real prices.
// Run:  node pricescry-study-selftest.mjs        (about 2-3 minutes)
//
// It builds fake markets with known effects planted in them and checks that the engine:
//   A. finds the planted effects, with about the right size and direction;
//   B. finds NOTHING real in a market where nothing was planted (no invented patterns);
//   C. in a time-ordered trade test, picks cards that really beat random choices when effects
//      exist, and does not when none exist;
//   D. recommends no trades when the cost of trading is higher than any effect;
//   G. the Japan selling-cost model does the sums right (fee on the sale price, fixed shipping);
//   H. with those costs, big percentage moves on CHEAP cards are not recommended, but the same
//      effect on dearer cards is.
// If a check here ever fails after a change, the change broke the method.

import { simulateMarket, PLANTED } from './pricescry-sim.mjs';
import { effectTable, walkForward, japanCostModel } from './pricescry-study.mjs';

let pass = 0, fail = 0;
const ck = (label, cond, extra = '') => { (cond ? pass++ : fail++); console.log((cond ? 'PASS ' : 'FAIL ') + label + (extra ? '  -> ' + extra : '')); };
const SEEDS = [11, 22, 33, 44, 55];
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const NOISE = Object.fromEntries(Object.entries(PLANTED).map(([k, v]) => [k, { ...v, mean: 0, sd: 0 }]));
const PLANTED_TYPES = ['tribal_enabler', 'commander_staple', 'reprint'];
const NULL_TYPES = ['weak_link', 'fake_leak'];
const t0 = Date.now();

console.log('--- A. planted effects are found, with the right sign and about the right size');
let found = 0, plantedTotal = 0, falseFlag = 0, nullTotal = 0; const errs = [];
for (const seed of SEEDS) {
  const { src, events, truth } = simulateMarket({ seed, nEvents: 110 });
  const { rows } = effectTable(events, src, { placeboReps: 100, bootReps: 0, horizons: [3, 7] });
  const at7 = rows.filter(r => r.h === 7);
  for (const r of at7) {
    const [type, band] = r.group.split('|');
    if (PLANTED_TYPES.includes(type)) {
      plantedTotal++;
      const tm = mean(truth.filter(t => t.type === type && t.band === band).map(t => t.effect));
      if (r.significant && Math.sign(r.meanAbn) === Math.sign(tm)) found++;
      if (r.n >= 30) errs.push(Math.abs(r.meanAbn - tm));
    } else if (NULL_TYPES.includes(type)) { nullTotal++; if (r.significant) falseFlag++; }
  }
}
ck(`planted effects found: ${found} of ${plantedTotal} groups flagged with the right sign`, found / plantedTotal >= 0.85, `${(100 * found / plantedTotal).toFixed(0)}%`);
ck(`estimated effect size is close to the truth (average error ${(100 * mean(errs)).toFixed(1)} percentage points)`, mean(errs) <= 0.07);
ck(`groups with NO planted effect rarely flagged: ${falseFlag} of ${nullTotal}`, falseFlag / nullTotal <= 0.15, `${(100 * falseFlag / nullTotal).toFixed(0)}%`);

console.log('--- B. a market with nothing planted: the engine must not invent patterns');
let runsWithAny = 0, flagged = 0, tested = 0;
for (const seed of SEEDS) {
  const { src, events } = simulateMarket({ seed: seed + 100, nEvents: 110, effects: NOISE });
  const { rows } = effectTable(events, src, { placeboReps: 100, bootReps: 0, horizons: [3, 7] });
  const testable = rows.filter(r => r.nEvents >= 5), f = testable.filter(r => r.significant).length;
  if (f > 0) runsWithAny++; flagged += f; tested += testable.length;
}
ck(`noise-only: ${flagged} of ${tested} groups flagged (expect close to none)`, flagged / tested <= 0.08, `${(100 * flagged / tested).toFixed(1)}%`);
ck(`noise-only: ${runsWithAny} of ${SEEDS.length} runs had any false flag (a 10% false-discovery setting allows about 1 in 10)`, runsWithAny <= 2);

console.log('--- C. time-ordered trade test (each pick uses only events that had finished before it)');
const wfOpts = { hStar: 7, cost: 0.10, topK: 5, pMin: 0.35, margin: 0.05, minTrainEvents: 30 };
let edgeWins = 0, picksP = [], hitP = [], edges = [];
for (const seed of SEEDS) {
  const { src, events } = simulateMarket({ seed: seed + 200, nEvents: 200 });
  const wf = walkForward(events, src, wfOpts);
  picksP.push(wf.picks); if (wf.hitRate != null) hitP.push(wf.hitRate); if (wf.edgeOverAllLinks != null) edges.push(wf.edgeOverAllLinks);
  if (wf.edgeCI && wf.edgeCI[0] > 0) edgeWins++;
}
ck(`planted: picks beat the average linked card in ${edgeWins} of ${SEEDS.length} runs (95% range above zero)`, edgeWins >= 4, `average edge ${(100 * mean(edges)).toFixed(1)} points per pick after costs`);
ck(`planted: ${(100 * mean(hitP)).toFixed(0)}% of picks were profitable after costs`, mean(hitP) >= 0.6);
let nullBeat = 0, nullPicks = [];
for (const seed of SEEDS) {
  const { src, events } = simulateMarket({ seed: seed + 300, nEvents: 200, effects: NOISE });
  const wf = walkForward(events, src, wfOpts);
  nullPicks.push(wf.picks);
  if (wf.edgeCI && wf.edgeCI[0] > 0) nullBeat++;
}
ck(`noise-only: picks showed a 'significant' edge in ${nullBeat} of ${SEEDS.length} runs (should be about none)`, nullBeat <= 1, `average picks ${mean(nullPicks).toFixed(0)}`);

console.log('--- D. costs: when trading costs more than any effect, recommend nothing');
let costPicks = 0;
for (const seed of SEEDS.slice(0, 3)) {
  const { src, events } = simulateMarket({ seed: seed + 200, nEvents: 200 });
  costPicks += walkForward(events, src, { ...wfOpts, cost: 0.60 }).picks;
}
ck('60% round-trip cost: no trades recommended', costPicks === 0, `${costPicks} picks`);

console.log('--- G. Japan selling costs (Mercari: 10% of the sale price, plus 230 yen tracked shipping and about 30 yen of packing)');
{
  const m = japanCostModel();
  const be = (y) => m.breakEvenYen(y);
  const expect = (y) => (y + 260) / (0.9 * y) - 1;           // worked out by hand
  ck('break-even for a 1,000-yen card is +40%', Math.abs(be(1000) - expect(1000)) < 1e-9 && Math.abs(be(1000) - 0.40) < 0.002, `+${(100 * be(1000)).toFixed(1)}%`);
  ck('break-even falls as the card gets dearer: +25.6% at 2,000 yen, +14.0% at 10,000 yen', be(2000) < be(1000) && be(10000) < be(2000) && Math.abs(be(2000) - 0.256) < 0.002 && Math.abs(be(10000) - 0.140) < 0.002);
  ck('a card that rises exactly its break-even earns exactly nothing', Math.abs(m.netReturn(be(3000), 3000 / m.params.usdToJpy)) < 1e-9);
  ck('a cheaper selling channel lowers the bar (5% fee: 2,000-yen card needs +18.9%, not +25.6%)', japanCostModel({ sellFeePct: 0.05 }).breakEvenYen(2000) < be(2000) && Math.abs(japanCostModel({ sellFeePct: 0.05 }).breakEvenYen(2000) - ((2000 + 260) / (0.95 * 2000) - 1)) < 1e-9);
  const t = japanCostModel({ shipYen: 70, trackedAboveYen: 3000 });
  ck('optional: with cheap untracked mail, a 2,000-yen card uses it and a 6,000-yen card pays the tracked 230', Math.abs(t.breakEvenYen(2000) - ((2000 + 100) / (0.9 * 2000) - 1)) < 1e-9 && Math.abs(t.breakEvenYen(6000) - ((6000 + 230 + 30) / (0.9 * 6000) - 1)) < 1e-9);
}
console.log('--- H. with real costs, the biggest % movers are not always the best trades');
{
  const model = japanCostModel({ usdToJpy: 150 });
  const run = (scale) => { let picks = 0, wins = 0, edges = [];
    for (const seed of SEEDS.slice(0, 3)) {
      const { src, events } = simulateMarket({ seed: seed + 600, nEvents: 200, priceScale: scale });
      const wf = walkForward(events, src, { hStar: 7, topK: 5, pMin: 0.35, margin: 0.05, minTrainEvents: 30, costModel: model });
      picks += wf.picks; if (wf.edgeCI && wf.edgeCI[0] > 0) wins++; if (wf.edgeOverAllLinks != null) edges.push(wf.edgeOverAllLinks);
    } return { picks, wins, edge: edges.length ? mean(edges) : null }; };
  const cheap = run(1), dear = run(25);
  ck(`cheap market (typical card about 225 yen): the same effects exist but costs eat most of them, so only ${cheap.picks} picks (vs ${dear.picks} in the dearer market)`, cheap.picks * 5 < dear.picks, `${cheap.picks} picks`);
  ck(`dearer market (typical card about 5,600 yen): the effects are tradeable, ${dear.picks} picks, edge above average in ${dear.wins} of 3 runs`, dear.picks >= 20 && dear.wins >= 2, `average edge ${dear.edge == null ? 'n/a' : (100 * dear.edge).toFixed(1) + ' points'}`);
}

console.log('--- E. (information, not a pass/fail) how small an effect can 110 events reveal?');
for (const m of [0.05, 0.10, 0.20]) {
  let hit = 0, tot = 0;
  for (const seed of SEEDS) {
    const eff = { ...NOISE, tribal_enabler: { mean: m, sd: 0.03, event: 'spoiler' } };
    const { src, events } = simulateMarket({ seed: seed + 400, nEvents: 110, effects: eff });
    const { rows } = effectTable(events, src, { placeboReps: 100, bootReps: 0, horizons: [7] });
    for (const r of rows.filter(r => r.group.startsWith('tribal_enabler'))) { tot++; if (r.significant) hit++; }
  }
  console.log(`   a planted effect of about +${(100 * m).toFixed(0)}% was flagged in ${hit} of ${tot} groups (${(100 * hit / tot).toFixed(0)}%)`);
}
console.log('--- F. (information) the same test in a HARSH market: 2.5x the day-to-day noise');
console.log('   Real card prices are far noisier and messier than this simulation (illiquid cards, spikes, unrelated news),');
console.log('   so treat the passes above as "the method works mechanically", not as a forecast of real performance.');
for (const m of [0.05, 0.10, 0.20]) {
  let hit = 0, tot = 0;
  for (const seed of SEEDS.slice(0, 3)) {
    const eff = { ...NOISE, tribal_enabler: { mean: m, sd: 0.03, event: 'spoiler' } };
    const { src, events } = simulateMarket({ seed: seed + 500, nEvents: 110, effects: eff, noiseMult: 2.5 });
    const { rows } = effectTable(events, src, { placeboReps: 100, bootReps: 0, horizons: [7] });
    for (const r of rows.filter(r => r.group.startsWith('tribal_enabler'))) { tot++; if (r.significant) hit++; }
  }
  console.log(`   a planted effect of about +${(100 * m).toFixed(0)}%, harsh noise: flagged in ${hit} of ${tot} groups (${(100 * hit / tot).toFixed(0)}%)`);
}
console.log(`\n${pass} passed, ${fail} failed  (${((Date.now() - t0) / 1000).toFixed(0)} seconds)`);
if (fail) process.exit(1);
