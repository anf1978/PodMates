// PriceScry link engine: for a NEW card (a spoiler), which EXISTING cards might people rush to buy?
// This is the "synergy as a first-class feature" the thesis needs. It reads rules text only (no prices), so it
// works the moment a spoiler appears and can be applied identically to every past spoiler when learning.
//
// Link types, strongest first:
//   named    the new card's text names an existing card
//   tribal   the new card cares about a creature type (or has it) and the other card is that type / cares about it
//   mechanic the two share a mechanic tag (counters, tokens, graveyard, sacrifice, landfall, artifacts ...)
//   enabler  the new card is a commander-style legend and the other card is a staple in its colours
// A shared tag only counts as strongly as it is rare: sharing "draw a card" means little, sharing "proliferate" means a lot.
// Card tuple (as in the app's database): [name, typeLine, oracle, manaCost, colorIdentity, manaValue, pips, rarity, producedMana, oneShot]

export const MECHANICS = {
  counters: /\+1\/\+1 counter|put (a|an|one|two|three|x|\d+) [a-z+\/0-9 ]*counters? on/i,
  proliferate: /proliferate/i,
  tokens: /create (a|an|one|two|three|four|x|\d+)[^.]*token/i,
  sacrifice: /sacrifice (a|an|another|two|x|\d+)|whenever [^.]* (is )?sacrificed|dies/i,
  graveyard: /from (your|a|any) graveyard|graveyard to|in (your|a) graveyard|mill|self-mill/i,
  reanimate: /return [^.]*creature card[^.]*from (your|a) graveyard to the battlefield|reanimate/i,
  landfall: /landfall|whenever a land (enters|you control enters)/i,
  extraland: /additional land|put a land card[^.]*onto the battlefield|play an additional land/i,
  artifacts: /\bartifacts?\b/i,
  enchantments: /\benchantments?\b|constellation/i,
  etb: /enters (the battlefield|under your control)|enters,/i,
  blink: /exile (target|another|up to)[^.]*(creature|permanent)[^.]*then return|flicker|blink/i,
  copy: /copy (target|of|that)|create a token that's a copy/i,
  treasure: /treasure/i,
  lifegain: /gain \d+ life|you gain life|whenever you gain life|lifelink/i,
  drain: /each opponent loses \d+ life|loses \d+ life/i,
  discard: /discard/i,
  draw: /draw (a|two|three|x|\d+) cards?|whenever you draw/i,
  spells: /instant or sorcery|noncreature spell|whenever you cast/i,
  storm: /\bstorm\b|copy (target|that) (instant|sorcery)|magecraft/i,
  mana: /add \{|adds? (one|two|x)|double the amount of mana|untap target land/i,
  cheat: /without paying (its|their) mana cost|put [^.]*onto the battlefield/i,
  voltron: /equipped creature|aura|equipment|attach/i,
  combatdmg: /deals? combat damage to a player|double strike|extra combat|additional combat/i,
  wheel: /each player discards (their|his or her) hand|wheel|draws? (seven|7) cards/i,
  stax: /can't (cast|play|activate)|doesn't untap|skip (your|their|each)|pay \{?\d+\}? (more|additional)/i,
  wipe: /destroy all|each creature|all creatures get -|exile all/i,
  tutor: /search your library for (a|an|up to|any)/i,
  energy: /\{e\}|energy counter/i,
  vehicles: /\bvehicles?\b|crew \d/i,
  dungeon: /venture|dungeon/i,
  exile_cast: /cast (it|that card|them)[^.]*(exiled|from exile)|impulse|exile the top card of your library/i,
};
const KEYWORDS = ['flying', 'deathtouch', 'haste', 'trample', 'menace', 'vigilance', 'hexproof', 'indestructible', 'flash', 'ward', 'first strike', 'infect', 'toxic', 'cascade', 'convoke', 'delve', 'affinity', 'equip', 'kicker', 'flashback', 'madness', 'prowess', 'afterlife', 'persist', 'undying', 'evoke', 'exploit', 'investigate', 'connive', 'blitz', 'offspring', 'backup', 'impending', 'airbending', 'earthbend', 'saddle', 'disguise', 'plot', 'squad', 'casualty'];

const TYPE_LINE_SPLIT = /\s[—-]\s/;
function typesOf(tl) {                                   // creature subtypes of the first face
  const first = String(tl || '').split('//')[0];
  const parts = first.split(TYPE_LINE_SPLIT);
  if (parts.length < 2 || !/creature|kindred|tribal|changeling/i.test(parts[0])) return [];
  return parts[1].trim().split(/\s+/).filter(Boolean);
}
const PLURAL_ODD = { elf: 'elves', wolf: 'wolves', dwarf: 'dwarves', 'zombie': 'zombies', 'goblin': 'goblins', 'sphinx': 'sphinxes', 'fungus': 'fungi', 'werewolf': 'werewolves', 'thief': 'thieves', 'faerie': 'faeries', 'mouse': 'mice', 'cat': 'cats' };
function mentionsType(oracle, t) {
  const o = String(oracle || '').toLowerCase(); const k = t.toLowerCase();
  const pl = PLURAL_ODD[k] || (k.endsWith('s') ? k : k + 's');
  return new RegExp('\\b(' + k + '|' + pl + ')\\b').test(o);
}
const NOT_TRIBES = new Set(['Human', 'Aura', 'Equipment', 'Saga', 'Rogue']); // too common or not tribes for tag purposes (Human/Rogue still counted as types, just not strong links)

export function featuresOf(t) {
  const [name, typeLine, oracle, , ci, mv, , rarity] = t;
  const text = String(oracle || '');
  const mech = []; for (const [k, re] of Object.entries(MECHANICS)) if (re.test(text)) mech.push(k);
  const kw = KEYWORDS.filter(w => new RegExp('\\b' + w + '\\b', 'i').test(text));
  const types = typesOf(typeLine);
  const cares = types.length ? [] : [];
  return { name, mech, kw, types, ci: ci || '', mv: mv || 0, rarity, legend: /legendary/i.test(typeLine || '') && /creature|planeswalker/i.test(typeLine || ''), isLand: /\bland\b/i.test(typeLine || ''), text };
}

export function buildIndex(cards) {
  const feats = cards.map(featuresOf);
  const df = new Map();                                  // how many cards carry each tag -> rarer tags mean more
  const bump = k => df.set(k, (df.get(k) || 0) + 1);
  const typeCount = new Map(); const byType = new Map(); const byMech = new Map(); const byName = new Map();
  feats.forEach((f, i) => {
    new Set(f.mech.map(m => 'm:' + m).concat(f.kw.map(w => 'k:' + w))).forEach(bump);
    for (const ty of f.types) { typeCount.set(ty, (typeCount.get(ty) || 0) + 1); (byType.get(ty) || byType.set(ty, []).get(ty)).push(i); }
    for (const m of f.mech) (byMech.get(m) || byMech.set(m, []).get(m)).push(i);
    byName.set(f.name.toLowerCase(), i);
  });
  // a card "cares about" a creature type if its text names it: precompute per type the cards that mention it
  const caresAbout = new Map();
  const tribes = [...typeCount.keys()].filter(t => typeCount.get(t) >= 8 && !NOT_TRIBES.has(t));
  const mention = tribes.map(t => ({ t, re: new RegExp('\\b(' + t.toLowerCase() + '|' + (PLURAL_ODD[t.toLowerCase()] || t.toLowerCase() + 's') + ')\\b') }));
  feats.forEach((f, i) => { const o = f.text.toLowerCase(); f.cares = []; for (const { t, re } of mention) if (re.test(o)) { f.cares.push(t); (caresAbout.get(t) || caresAbout.set(t, []).get(t)).push(i); } });
  return { cards, feats, df, n: cards.length, byType, byMech, byName, caresAbout, typeCount, tribes };
}

const idf = (ix, k) => Math.log(ix.n / (1 + (ix.df.get(k) || 0)));

// Returns the existing cards most likely to be re-priced by `newCard` (a tuple), best first.
// Each hit: { name, score, links: [{type, why}] }.
export function linksFor(newCard, ix, { top = 25, minScore = 1 } = {}) {
  const nf = featuresOf(newCard);
  const ni = ix.byName.get(nf.name.toLowerCase());
  const score = new Map(); const why = new Map();
  const add = (i, s, type, text) => { if (i === ni) return; score.set(i, (score.get(i) || 0) + s); (why.get(i) || why.set(i, []).get(i)).push({ type, why: text }); };

  // named: the text names an existing card ("Ghost Quarter" style). Names are quoted in oracle text only on a few cards, so match whole-name occurrences of longer names.
  const lower = nf.text.toLowerCase();
  for (const [nm, i] of ix.byName) if (nm.length >= 9 && lower.includes(nm) && nm !== nf.name.toLowerCase()) add(i, 10, 'named', 'the new card names it');

  // tribal
  const careTypes = ix.tribes.filter(t => mentionsType(nf.text, t));
  for (const t of careTypes) {                                           // new card is a payoff for type t -> members of t gain demand
    const members = ix.byType.get(t) || [];
    const w = 3 + Math.min(3, Math.log10(1 + (ix.caresAbout.get(t) || []).length));
    for (const i of members) add(i, w * (ix.feats[i].legend ? 1.4 : 1), 'tribal', `${t} (the new card rewards ${t}s)`);
  }
  for (const t of nf.types.filter(t => ix.tribes.includes(t))) {          // new card IS type t -> existing payoffs for t gain demand
    for (const i of ix.caresAbout.get(t) || []) add(i, 3, 'tribal', `${t} payoff (the new card is a ${t})`);
  }

  // mechanic overlap (rare shared tags weigh more)
  const tags = nf.mech.map(m => 'm:' + m).concat(nf.kw.map(w => 'k:' + w));
  for (const tag of tags) {
    const w = idf(ix, tag); if (w < 1.2) continue;                        // very common tags carry no information
    const pool = tag[0] === 'm' ? ix.byMech.get(tag.slice(2)) || [] : null;
    if (pool) for (const i of pool) add(i, w * 0.7, 'mechanic', tag.slice(2));
  }
  // enabler: a new legend, and cards in its colours that share a mechanic or type with it
  const ids = new Set(nf.ci.split(''));
  const out = [];
  for (const [i, s] of score) {
    const f = ix.feats[i];
    const fits = !f.ci || f.ci.split('').every(c => ids.has(c));             // card fits in the new card's colour identity
    let sc = s; const lk = why.get(i);
    if (nf.legend) { if (fits) { sc *= 1.25; lk.push({ type: 'enabler', why: 'fits the new commander\'s colours' }); } else sc *= 0.6; }
    if (sc >= minScore) out.push({ name: f.name, score: Math.round(sc * 100) / 100, links: lk });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, top);
}
export function strongestType(hit) { const order = ['named', 'tribal', 'mechanic', 'enabler']; for (const o of order) if (hit.links.some(l => l.type === o)) return o; return 'mechanic'; }
