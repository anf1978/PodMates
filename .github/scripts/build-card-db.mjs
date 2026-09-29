// PodMates card database builder -- reverse-engineered from the app's own
// decompressCardDB() function, since the original build script no longer
// exists anywhere accessible. Produces the exact payload shape and gzip
// compression that function expects.
//
// Usage: node build-card-db.mjs <path-to-scryfall-bulk-file> [output-file]
// Handles the input whether it's gzip-compressed or plain text -- Scryfall
// serves its bulk data pre-gzipped (a .jsonl.gz download), which the first
// version of this script didn't account for: it read the compressed bytes
// as if they were already plain text, every line failed to parse, and it
// silently produced an empty database instead of erroring. Detecting the
// gzip magic bytes and decompressing when present fixes that regardless of
// how this script gets invoked or whether Scryfall's serving format changes.

import { readFileSync, writeFileSync } from 'fs';
import { gzipSync, gunzipSync } from 'zlib';

// A real Oracle Cards file has been in the 25,000-30,000+ range for years
// and only grows over time. Anything wildly below that means something
// upstream went wrong (a bad download, an unexpected format change, a
// parsing bug) -- refusing to write output in that case is what stops a
// broken build from ever reaching a commit and overwriting a working
// database, rather than silently producing an empty or near-empty one.
const MIN_PLAUSIBLE_CARD_COUNT = 5000;

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

// Reads the input file and returns its content as plain text, transparently
// decompressing first if it looks gzip-compressed (magic bytes 0x1f 0x8b).
function readInputAsText(path) {
  const buf = readFileSync(path);
  const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  const raw = isGzip ? gunzipSync(buf) : buf;
  return { text: raw.toString('utf8'), wasGzipped: isGzip };
}

// ---- Main build ---------------------------------------------------------
function build(bulkFilePath, outPath) {
  const { text, wasGzipped } = readInputAsText(bulkFilePath);
  console.log(wasGzipped ? 'Input was gzip-compressed -- decompressed before parsing.' : 'Input was plain text.');

  const cards = [];
  const gc = [];
  const banned = [];
  const seenNames = new Set();

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const trimmed = rawLine.trim().replace(/,$/, '');
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

  if (cards.length < MIN_PLAUSIBLE_CARD_COUNT) {
    throw new Error(
      `Only parsed ${cards.length} cards, expected at least ${MIN_PLAUSIBLE_CARD_COUNT}. ` +
      `Refusing to write output -- something is wrong with the input file rather than trusting ` +
      `this result, since committing a near-empty database would silently break the live app.`
    );
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
  console.error('Usage: node build-card-db.mjs <scryfall-bulk-file> [output-file]');
  process.exit(1);
}
try {
  const stats = build(bulkFilePath, outPath || 'card-db-compressed.b64');
  console.log('Build complete:', stats);
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
