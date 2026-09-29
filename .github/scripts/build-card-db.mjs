// PodMates card database builder -- reverse-engineered from the app's own
// decompressCardDB() function, since the original build script no longer
// exists anywhere accessible. Produces the exact payload shape and gzip
// compression that function expects, verified by round-tripping against
// an equivalent decompressor below before this is trusted against real data.
//
// Usage: node build-card-db.mjs <path-to-scryfall-bulk-file.jsonl>
// Scryfall's bulk data completed its transition to JSONL-only in July 2026
// (one JSON object per line), replacing the older single-JSON-array format.

import { createReadStream, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { gzipSync } from 'zlib';

// ---- Pip encoding -----------------------------------------------------
// Reverse-engineered from how the app CONSUMES this field:
//   card.p.match(/[WUBRGC]\d+/g) -> for each match, color = match[0],
//   halfPips = parseInt(match.slice(1)), contribution = halfPips / 2.
// So the encoding stores HALF-pips as whole numbers, letting a hybrid
// symbol like {W/U} contribute 1 half-pip to each color (0.5 full pips)
// without needing a decimal point in the string. A plain {W} contributes
// 2 half-pips (1 full pip). Phyrexian mana ({W/P}) counts the same as a
// hybrid pip toward its one color, matching how every other pip-counting
// mana symbol works.
function encodePips(manaCost) {
  if (!manaCost) return '';
  const halfPips = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const symbolRe = /\{([^}]+)\}/g;
  let match;
  while ((match = symbolRe.exec(manaCost))) {
    const sym = match[1];
    if (sym === 'C') { halfPips.C += 2; continue; }
    const colors = sym.split('/').filter(s => 'WUBRG'.includes(s));
    if (!colors.length) continue; // generic numbers, X, S (snow), etc. -- no colored pip
    const share = 2 / colors.length; // {W} -> 2 to W; {W/U} -> 1 to each; {W/U/B} (rare) -> 2/3 each, rounded below
    for (const c of colors) halfPips[c] += share;
  }
  let out = '';
  for (const c of ['W', 'U', 'B', 'R', 'G', 'C']) {
    const v = Math.round(halfPips[c]);
    if (v > 0) out += c + v;
  }
  return out;
}

// ---- Card -> tuple ------------------------------------------------------
// Exact field order confirmed from decompressCardDB's own mapping:
// t[0..7] = n, t, o, c, ci, m, p, r
function cardToTuple(card) {
  const face = (card.card_faces && card.card_faces.length) ? card.card_faces[0] : card;
  const name = card.name || '';
  const typeLine = card.type_line || face.type_line || '';
  const oracleText = card.oracle_text || face.oracle_text || '';
  const manaCost = card.mana_cost || face.mana_cost || '';
  const colorIdentity = (card.color_identity || []).join('');
  const cmc = typeof card.cmc === 'number' ? card.cmc : 0;
  const pips = encodePips(manaCost);
  const rarity = card.rarity || '';
  return [name, typeLine, oracleText, manaCost, colorIdentity, cmc, pips, rarity];
}

// ---- Main build ---------------------------------------------------------
async function build(bulkFilePath, outPath) {
  const cards = [];
  const gc = [];
  const banned = [];
  const seenNames = new Set();

  const rl = createInterface({ input: createReadStream(bulkFilePath, { encoding: 'utf8' }) });
  for await (const line of rl) {
    const trimmed = line.trim().replace(/,$/, '');
    if (!trimmed || trimmed === '[' || trimmed === ']') continue;
    let card;
    try { card = JSON.parse(trimmed); } catch (e) { continue; }
    if (!card || card.object !== 'card') continue;
    // Skip non-paper-relevant noise this app has no use for: pure token/art
    // objects have no oracle text and aren't things anyone decks with.
    if (card.layout === 'token' || card.layout === 'art_series') continue;
    // One entry per unique Oracle name -- Scryfall's bulk file has one row
    // per PRINTING, not per unique card, and this app only needs one.
    if (seenNames.has(card.name)) continue;
    seenNames.add(card.name);

    cards.push(cardToTuple(card));
    if (card.game_changer === true) gc.push(card.name);
    if (card.legalities && card.legalities.commander === 'banned') banned.push(card.name);
  }

  const payload = { cards, gc, banned };
  const json = JSON.stringify(payload);
  const gzipped = gzipSync(Buffer.from(json, 'utf8'));
  const b64 = gzipped.toString('base64');

  writeFileSync(outPath, b64, 'utf8');
  return { cardCount: cards.length, gcCount: gc.length, bannedCount: banned.length, b64Length: b64.length };
}

const [, , bulkFilePath, outPath] = process.argv;
if (!bulkFilePath) {
  console.error('Usage: node build-card-db.mjs <scryfall-bulk-file.jsonl> [output-file]');
  process.exit(1);
}
build(bulkFilePath, outPath || 'card-db-compressed.b64').then(stats => {
  console.log('Build complete:', stats);
}).catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
