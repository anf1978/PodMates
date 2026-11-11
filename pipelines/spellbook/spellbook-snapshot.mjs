// Builds PodMates' offline Commander Spellbook snapshot from the public data export.
//   node spellbook-snapshot.mjs <variants.json> <out-folder>
// Writes into <out-folder>:
//   spellbook-snapshot.json.gz   the compact snapshot (see the shape below)
//   spellbook-stats.txt          counts and distributions, used to choose which combos count
// The export is ~700 MB, too big for one string, so it is read in pieces and one combo is parsed at a time.
//
// Snapshot shape (all indexes refer to the two tables):
//   { v:1, date:"2026-10-12T..", n:[card names], f:[feature names],
//     c:[ [ [cardIdx,...], tag, popularity, manaValueNeeded, [featureIdx,...], prerequisitesFlag ], ... ] }
// Only combos that are status OK, legal in Commander, made of 2-6 named cards, and with NO template
// requirements ("any creature" style slots), because a named-card match cannot test those.
import fs from 'fs';
import zlib from 'zlib';
import { StringDecoder } from 'string_decoder';

const [, , inFile, outDir] = process.argv;
if (!inFile || !outDir) { console.error('usage: node spellbook-snapshot.mjs variants.json outdir'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const names = new Map(), feats = new Map(), rows = [];
const stat = { total: 0, status: {}, bySize: {}, byTag: {}, withRequires: 0, notLegal: 0, kept: 0, noNamedCards: 0, versionInfo: '' };
const featCount = new Map(), pops = [], manaVals = {}, tagPop = {};
let firstFull = null, timestamp = '';

const idx = (map, key) => { let i = map.get(key); if (i === undefined) { i = map.size; map.set(key, i); } return i; };
const featName = p => (p && p.feature && p.feature.name) || (p && p.name) || (typeof p === 'string' ? p : null);

function handle(txt) {
  let v; try { v = JSON.parse(txt); } catch (e) { return; }
  stat.total++;
  stat.status[v.status] = (stat.status[v.status] || 0) + 1;
  if (!firstFull) firstFull = { keys: Object.keys(v), requires: JSON.stringify(v.requires || []).slice(0, 400), produces: JSON.stringify(v.produces || []).slice(0, 500), of: JSON.stringify(v.of || []).slice(0, 300), includes: JSON.stringify(v.includes || []).slice(0, 200), use0: JSON.stringify((v.uses || [])[0] || {}).replace(/https?:[^"]+/g, 'URL').slice(0, 700) };
  if (v.status && v.status !== 'OK') return;
  if (v.legalities && v.legalities.commander === false) { stat.notLegal++; return; }
  if (v.requires && v.requires.length) { stat.withRequires++; return; }
  const cs = (v.uses || []).map(u => u.card && u.card.name).filter(Boolean);
  if (cs.length < 2 || cs.length > 6 || cs.length !== (v.uses || []).length) { stat.noNamedCards++; return; }
  stat.bySize[cs.length] = (stat.bySize[cs.length] || 0) + 1;
  const tag = String(v.bracketTag || '?');
  stat.byTag[tag] = (stat.byTag[tag] || 0) + 1;
  const pop = Number(v.popularity) || 0;
  pops.push(pop);
  (tagPop[tag] = tagPop[tag] || []).push(pop);
  const mv = Number(v.manaValueNeeded) || 0;
  manaVals[Math.min(mv, 20)] = (manaVals[Math.min(mv, 20)] || 0) + 1;
  const fs_ = (v.produces || []).map(featName).filter(Boolean);
  fs_.forEach(f => featCount.set(f, (featCount.get(f) || 0) + 1));
  const prereq = (v.easyPrerequisites || v.notablePrerequisites) ? 1 : 0;
  rows.push([cs.map(n => idx(names, n)), tag, pop, mv, fs_.map(f => idx(feats, f)), prereq]);
  stat.kept++;
}

// Cut each object out of the "variants" array, tracking quotes and brackets.
let inVariants = false, inStr = false, esc = false, objDepth = 0, cur = '', carry = '', head = '';
function feed(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!inVariants) {
      carry = (carry + c).slice(-14);
      if (head.length < 400) head += c;
      if (c === '[' && /"variants":\s*\[$/.test(carry)) inVariants = true;
      continue;
    }
    if (inStr) { cur += c; if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; if (objDepth > 0) cur += c; continue; }
    if (c === '{') objDepth++;
    if (objDepth > 0) cur += c;
    if (c === '}') { objDepth--; if (objDepth === 0) { handle(cur); cur = ''; } }
    else if (c === ']' && objDepth === 0) inVariants = false;
  }
}
const fd = fs.openSync(inFile, 'r');
const buf = Buffer.alloc(8 * 1024 * 1024), dec = new StringDecoder('utf8');
let n;
while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) feed(dec.write(buf.subarray(0, n)));
const tm = /"timestamp":\s*"([^"]+)"/.exec(head); timestamp = tm ? tm[1] : '';
const vm_ = /"version":\s*"([^"]+)"/.exec(head); stat.versionInfo = vm_ ? vm_[1] : '';

const snap = { v: 1, date: timestamp, src: stat.versionInfo, n: Array.from(names.keys()), f: Array.from(feats.keys()), c: rows };
const json = JSON.stringify(snap);
const gz = zlib.gzipSync(Buffer.from(json), { level: 9 });
fs.writeFileSync(`${outDir}/spellbook-snapshot.json.gz`, gz);

const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const lines = [];
lines.push(`export timestamp ${timestamp}, version ${stat.versionInfo}`);
lines.push(`combos in export ${stat.total}; statuses ${JSON.stringify(stat.status)}`);
lines.push(`dropped: not commander-legal ${stat.notLegal}; has template requirements ${stat.withRequires}; not 2-6 named cards ${stat.noNamedCards}`);
lines.push(`KEPT ${stat.kept}; unique cards ${names.size}; unique features ${feats.size}`);
lines.push(`json bytes ${json.length}; gzipped ${gz.length}; base64 ${Math.ceil(gz.length * 4 / 3)}`);
lines.push(`by size ${JSON.stringify(stat.bySize)}`);
lines.push(`by bracketTag ${JSON.stringify(stat.byTag)}`);
lines.push(`popularity percentiles: p50 ${q(pops, .5)} p75 ${q(pops, .75)} p90 ${q(pops, .9)} p99 ${q(pops, .99)} max ${q(pops, 1)}; combos with popularity > 0: ${pops.filter(p => p > 0).length}`);
Object.keys(tagPop).forEach(t => lines.push(`  tag ${t}: n ${tagPop[t].length}, median popularity ${q(tagPop[t], .5)}, p90 ${q(tagPop[t], .9)}`));
lines.push(`manaValueNeeded distribution ${JSON.stringify(manaVals)}`);
lines.push('--- produced features (name: combos), top 70 ---');
Array.from(featCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 70).forEach(([k, v]) => lines.push(`${v}\t${k}`));
lines.push('--- first combo, field shapes ---');
if (firstFull) Object.keys(firstFull).forEach(k => lines.push(`${k}: ${Array.isArray(firstFull[k]) ? firstFull[k].join(', ') : firstFull[k]}`));
fs.writeFileSync(`${outDir}/spellbook-stats.txt`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
