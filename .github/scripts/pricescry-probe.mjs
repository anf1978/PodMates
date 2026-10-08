// Fetches ONE web address and reports what comes back, so a new price source can be built
// against its real response instead of a guess.
// Usage: node pricescry-probe.mjs <url> [out-file]
// Prints the status, content type and size, shows the start of the body, and (if an
// out-file is given) saves the whole body. It makes a single request and does no crawling.

import { writeFileSync } from 'fs';

const url = process.argv[2];
const out = process.argv[3];
if (!url) { console.error('Usage: node pricescry-probe.mjs <url> [out-file]'); process.exit(1); }

const r = await fetch(url, { headers: { 'User-Agent': 'PodMatesPriceScry/1.0 (+https://github.com/anf1978/PodMates)', Accept: 'application/json,text/html;q=0.9,*/*;q=0.8' } });
const body = await r.text();
console.log('URL:         ', url);
console.log('Status:      ', r.status, r.statusText);
console.log('Content-Type:', r.headers.get('content-type'));
console.log('Size:        ', body.length, 'characters');
console.log('--- first 1500 characters ---');
console.log(body.slice(0, 1500));
try {
  const j = JSON.parse(body);
  const keys = (o, d = 0) => (o && typeof o === 'object' && d < 3) ? Object.fromEntries(Object.entries(o).slice(0, 8).map(([k, v]) => [k, Array.isArray(v) ? `array(${v.length}) of ${typeof v[0]}` : (v && typeof v === 'object') ? keys(v, d + 1) : typeof v])) : typeof o;
  console.log('--- JSON structure (top levels) ---'); console.log(JSON.stringify(keys(j), null, 2));
} catch { console.log('(not JSON)'); }
if (out) { writeFileSync(out, body); console.log('Saved to', out); }
if (!r.ok) process.exit(2);
