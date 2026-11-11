// .github/scripts/fetch-function-tags.mjs
// Pulls Scryfall Tagger function tags (otag:) for the few precise tags the app uses and writes a small JSON file:
//   { "blink": ["ghostway", ...], "extra-combat": [...] }   (front-face names, lower case, sorted)
// Usage: node fetch-function-tags.mjs function-tags.json
// To add a tag the app should know about, add it to TAGS here AND read it in index.html (IX_TAGS).
import { writeFileSync } from 'fs';

const OUT = process.argv[2] || 'function-tags.json';
const TAGS = ['blink', 'extra-combat'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'PodMates-weekly/1.0', Accept: 'application/json' } });
    if (r.ok) return r.json();
    if (r.status === 404) return null;                         // tag has no cards (or does not exist)
    if (r.status === 429 || r.status >= 500) { await sleep(1500 * i); continue; }
    throw new Error('HTTP ' + r.status + ' for ' + url);
  }
  throw new Error('Gave up after retries: ' + url);
}

const out = {};
for (const tag of TAGS) {
  let url = 'https://api.scryfall.com/cards/search?q=' + encodeURIComponent('otag:' + tag + ' f:commander') + '&unique=cards';
  const names = new Set();
  while (url) {
    const j = await get(url);
    if (!j) break;
    j.data.forEach((c) => names.add(String(c.name).split('//')[0].trim().toLowerCase()));
    url = j.has_more ? j.next_page : null;
    await sleep(120);                                         // be polite to Scryfall
  }
  out[tag] = [...names].sort();
  console.log(tag, out[tag].length);
}
writeFileSync(OUT, JSON.stringify(out));
