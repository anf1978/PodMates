// Run on your own machine (Node 18+): node fetch-scryfall-tags.mjs
// Pulls card names for a short list of Scryfall Tagger "function" tags (otag:) and writes scryfall-tags.json
// Be polite to Scryfall: 120ms between calls, one query per tag.
import { writeFileSync } from 'node:fs';
const TAGS = ['ramp','mana-dork','card-advantage','removal','sweeper','tutor','recursion','sacrifice-outlet','token-generator','blink','cost-reducer','anthem','lord','extra-combat','haste-enabler','repeatable-token-generator','untapper','mana-doubler','trigger-doubler'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = {};
for (const tag of TAGS) {
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`otag:${tag} f:commander`)}&unique=cards`;
  const names = [];
  while (url) {
    const r = await fetch(url, { headers: { 'User-Agent': 'PodMates-tagfetch/1.0', Accept: 'application/json' } });
    if (!r.ok) { console.log(tag, 'HTTP', r.status, '(tag may not exist)'); break; }
    const j = await r.json(); j.data.forEach(c => names.push(c.name)); url = j.has_more ? j.next_page : null; await sleep(120);
  }
  out[tag] = names; console.log(tag, names.length);
}
writeFileSync('scryfall-tags.json', JSON.stringify(out));
