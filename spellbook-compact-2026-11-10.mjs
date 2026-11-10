// Turns the full Spellbook snapshot (v1: every kept combo with all its produced features) into the small
// "app snapshot" (v2) that is embedded in index.html. Only combos that WIN or WARP a game are kept:
//   class 2 (win):  win/lose-the-game effects, infinite or near-infinite damage or life loss, library exile, and so on
//   class 1 (warp): infinite turns or combat phases, infinite mana, locks, mass land denial, library-cheat effects
// Pure "value loop" combos (infinite ETB/LTB/death/sacrifice triggers, tokens, lifegain, storm count...) are left out
// because they need a separate finisher to matter, EXCEPT two-card infinite loops, kept as class 0 for the Bracket rule only. A combo that merely extends a smaller kept combo (same cards plus
// more) is dropped, because wherever it matches, the smaller one matches too.
//
// v2 shape: { v:2, date, src, n:[card names], o:[outcome labels],
//             c:[ [ [cardIdx,...], code, outcomeIdx, popLog ], ... ] }
//   code = class (1 or 2) + 4 if the combo is "infinite" (counts for the Bracket two-card-combo rule)
//   popLog = round(log2(popularity + 1)), 0-17, used only to rank combos when a deck matches many
import zlib from 'zlib';

export const WIN_RE = /^(Win the game|Target opponent loses the game|Each opponent loses the game|Target player loses the game|Infinite damage|Near-infinite damage|Infinite combat damage|Infinite lifeloss|Near-infinite lifeloss|Exile each opponent's library|Infinite mill for target opponent|Each opponent sacrifices|Infinite poison|Destroy all creatures opponents control$|Exile all creatures opponents control)/i;
export const WARP_RE = /^(Infinite turns|Near-infinite turns|Infinite combat phases|Lock$|Mass Land Denial|Infinite colored mana|Infinite colorless mana|Infinite mana|Infinite red mana|Infinite green mana|Infinite black mana|Infinite blue mana|Infinite white mana|Players can't draw|Opponents skip|Exile your library$|Put all creature cards from your library onto the battlefield|Cast all spells in your library|Infinite card draw$|Infinitely large creature)/i;
const INFINITE_RE = /^(near-)?infinite/i;
// Which produced feature to show as the combo's headline (first match wins).
const LABEL_PRIORITY = [/^Win the game/i, /loses the game$/i, /^Infinite damage/i, /^Near-infinite damage/i, /^Infinite lifeloss/i, /^Near-infinite lifeloss/i,
  /^Infinite combat damage/i, /^Exile each opponent's library/i, /^Infinite mill/i, /^Each opponent sacrifices/i, /^Infinite turns/i, /^Infinite combat phases/i,
  /^Infinite mana/i, /^Infinite colorless mana/i, /^Infinite colored mana/i, /^Lock$/i, /^Mass Land Denial/i, /^Infinitely large creature/i, /^Infinite card draw$/i];

export function compactSnapshot(v1) {
  const cls = v1.f.map(n => (WIN_RE.test(n) ? 2 : WARP_RE.test(n) ? 1 : 0));
  const inf = v1.f.map(n => INFINITE_RE.test(n) || WIN_RE.test(n));
  const labels = [], labelIdx = new Map();
  const labelFor = (fi) => {
    const names = fi.map(i => v1.f[i]);
    let best = null;
    for (const re of LABEL_PRIORITY) { best = names.find(n => re.test(n)); if (best) break; }
    if (!best) best = names.find(n => WIN_RE.test(n) || WARP_RE.test(n)) || names[0];
    if (!labelIdx.has(best)) { labelIdx.set(best, labels.length); labels.push(best); }
    return labelIdx.get(best);
  };
  let rows = [];
  for (const r of v1.c) {
    const [cards, , pop, , fi] = r;
    const c = Math.max(0, ...fi.map(i => cls[i]));
    if (!c) continue;
    const isInf = fi.some(i => inf[i]);
    rows.push({ cards: cards.slice().sort((a, b) => a - b), code: c + (isInf ? 4 : 0), out: labelFor(fi.filter(i => cls[i] === c)), pop: Math.round(Math.log2((Number(pop) || 0) + 1)) });
  }
  // identical card sets: keep the strongest
  const byKey = new Map();
  for (const r of rows) { const k = r.cards.join(','); const o = byKey.get(k); if (!o || (r.code & 3) > (o.code & 3) || ((r.code & 3) === (o.code & 3) && r.pop > o.pop)) byKey.set(k, r); }
  // drop supersets of another kept combo
  const keys = new Set(byKey.keys());
  const kept = [];
  for (const [k, r] of byKey) {
    const n = r.cards.length; let sup = false;
    for (let mask = 1; mask < (1 << n) - 1 && !sup; mask++) {
      let cnt = 0; const sub = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) { sub.push(r.cards[i]); cnt++; }
      if (cnt >= 2 && keys.has(sub.join(','))) sup = true;
    }
    if (!sup) kept.push(r);
  }
  // Two-card INFINITE value loops (infinite ETB/LTB/death/sacrifice triggers, commander casts, tokens...).
  // They win nothing alone, but house rule: any two-card infinite combo makes a deck Bracket 3 at least.
  // Stored as class 0 + 4 (code 4). They are added AFTER the superset pruning above and never used to prune,
  // so a bigger win/warp line that extends one of them is still kept. The app uses them for the Bracket only.
  const keptKeys = new Set(kept.map(r => r.cards.join(',')));
  const loopBest = new Map();
  for (const r of v1.c) {
    const [cards, , pop, , fi] = r;
    if (cards.length !== 2 || fi.some(i => cls[i])) continue;           // two cards, no win/warp effect
    const inf0 = fi.filter(i => INFINITE_RE.test(v1.f[i]));
    if (!inf0.length) continue;
    const sorted = cards.slice().sort((a, b) => a - b), k = sorted.join(',');
    if (keptKeys.has(k)) continue;
    const label = v1.f[inf0[0]];
    if (!labelIdx.has(label)) { labelIdx.set(label, labels.length); labels.push(label); }
    const pr = Math.round(Math.log2((Number(pop) || 0) + 1));
    const o = loopBest.get(k);
    if (!o || pr > o.pop) loopBest.set(k, { cards: sorted, code: 4, out: labelIdx.get(label), pop: pr });
  }
  for (const r of loopBest.values()) kept.push(r);
  // remap card indexes to only the cards used
  const used = new Map(), n2 = [];
  const mapc = (i) => { let j = used.get(i); if (j === undefined) { j = n2.length; used.set(i, j); n2.push(v1.n[i]); } return j; };
  const c2 = kept.map(r => [r.cards.map(mapc), r.code, r.out, r.pop]);
  return { v: 2, date: v1.date, src: v1.src, n: n2, o: labels, c: c2 };
}

export function gzipJson(obj) { return zlib.gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 }); }
