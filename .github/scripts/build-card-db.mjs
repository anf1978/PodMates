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
//
// Card tuple (10 fields):
//   [name, typeLine, oracleText, manaCost, colorIdentity, manaValue, pips,
//    rarity, producedMana, oneShotFlag]
// The last two are what the Mana Base: Cost vs. Production panel needs:
//   producedMana - colors of mana the card can make ("" if none), e.g. "WG"
//   oneShotFlag  - 1 if that mana is one-time only (Dark Ritual, Lotus Petal),
//                  so it's listed separately instead of counted as a source
// An earlier build left these out entirely and the panel read other fields
// (mana value, rarity) in their place, which broke it. They are worked out
// here from each card's rules text -- see the shared block below.

import { readFileSync, writeFileSync } from 'fs';
import { gzipSync, gunzipSync } from 'zlib';

const MIN_PLAUSIBLE_CARD_COUNT = 5000;
// The real figure is ~2,000 cards that produce mana. If far fewer come out,
// the production logic has broken (the way the gzip bug once produced zero
// cards) -- fail loudly rather than publish a database that empties the panel.
const MIN_PLAUSIBLE_PRODUCER_COUNT = 800;

// ===== BEGIN SHARED MANA-PRODUCTION LOGIC =====
// This block is IDENTICAL in two places and must stay that way:
//   1. .github/scripts/build-card-db.mjs  (computes the values at database-build time)
//   2. index.html, engine-script          (fallback for a database built before these fields existed)
// Scryfall has no "what mana does this make" field that separates real mana
// abilities from Treasure/token makers, and no "one-shot ritual" concept at
// all, so both are worked out from a card's type line and rules text.
//
// analyzeManaFace(typeLine, oracleText) returns the colors a single card face
// can add, split into two groups:
//   sustained - a permanent ability it can use again and again
//               (lands, rocks, dorks, Signets, Wild Growth-style Auras)
//   oneShot   - mana it makes only once (instants/sorceries like Dark Ritual,
//               or "sacrifice this" / "exile from hand" abilities like Lotus
//               Petal and the Spirit Guides)
// Colors come back in WUBRGC order. "Any color" becomes WUBRG, "any type"
// adds C. Only real mana abilities count: Treasure/Spawn/Powerstone makers,
// abilities granted to other permanents ("quoted" text), reminder text, and
// mana doublers all correctly produce nothing.
const MANA_ORDER = 'WUBRGC';
function canonManaColors(colorSet) {
  let out = '';
  for (const c of MANA_ORDER) if (colorSet.has(c)) out += c;
  return out;
}
function analyzeManaFace(typeLine, oracleText) {
  const tl = String(typeLine || '').toLowerCase();
  const isLand = /\bland\b/.test(tl);
  const isSpell = /\b(instant|sorcery)\b/.test(tl);
  const isAura = /\baura\b/.test(tl);
  let text = String(oracleText || '');
  // Reminder text in (parentheses) explains rules; it is not the card's own
  // ability -- except on lands, where "({T}: Add {G}.)" can be the only place
  // the ability is written.
  if (!isLand) text = text.replace(/\([^)]*\)/g, '');
  // Text in "quotes" is an ability granted to a token or another permanent.
  text = text.replace(/["\u201C][^"\u201D]*["\u201D]/g, '');

  const sustained = new Set(), oneShot = new Set();
  const oneShotCost = /sacrifice (this|it)\b|exile (this card|it) from your hand/i;
  const ANY_COLOR = /\bany (one )?(color|type)\b|any combination of colors|different colors|of that color|chosen color|any of (those|the exiled card's|the|this [a-z]+'s) colors?|each color among/i;

  const absorb = (clause, set) => {
    const symRe = /\{([WUBRGC])\}|\{([WUBRG])\/([WUBRG])\}/g;
    let m;
    while ((m = symRe.exec(clause))) {
      if (m[1]) set.add(m[1]); else { set.add(m[2]); set.add(m[3]); }
    }
    if (ANY_COLOR.test(clause)) {
      for (const c of 'WUBRG') set.add(c);
      if (/\bany type\b/i.test(clause)) set.add('C');
    }
  };

  for (const line of text.split('\n')) {
    const addRe = /\badd\s+([^.]*)/gi;
    let m;
    if (isSpell) {
      while ((m = addRe.exec(line))) absorb(m[1], oneShot);
      continue;
    }
    const colon = line.indexOf(':');
    if (colon !== -1) {
      const cost = line.slice(0, colon), effect = line.slice(colon + 1);
      const target = oneShotCost.test(cost) ? oneShot : sustained;
      while ((m = addRe.exec(effect))) absorb(m[1], target);
    } else if (isAura) {
      // Wild Growth / Utopia Sprawl / Fertile Ground: the Aura adds mana when
      // the enchanted land is tapped.
      const aura = /enchanted [a-z]+ is tapped for mana[^.]*?\badds?\s+([^.]*)/i.exec(line);
      if (aura) absorb(aura[1], sustained);
    }
  }
  // Basic land types carry an intrinsic mana ability (Dryad Arbor, Jasconian
  // Isle, Snow-Covered basics, "Forest Dryad"...). Skipped on combined
  // "A // B" type lines, where the subtype could belong to the other face.
  if (isLand && !tl.includes('//')) {
    const dash = tl.indexOf('\u2014');
    const sub = dash === -1 ? '' : tl.slice(dash + 1);
    if (/\bplains\b/.test(sub)) sustained.add('W');
    if (/\bisland\b/.test(sub)) sustained.add('U');
    if (/\bswamp\b/.test(sub)) sustained.add('B');
    if (/\bmountain\b/.test(sub)) sustained.add('R');
    if (/\bforest\b/.test(sub)) sustained.add('G');
  }
  return { sustained: canonManaColors(sustained), oneShot: canonManaColors(oneShot) };
}
// Combines one or more faces of a card into the two values the database
// stores: pm = colors it can produce, rt = 1 if that production is one-shot only.
// A card that has BOTH a sustained and a one-shot ability (Crystal Vein) counts
// as a normal source of its sustained colors.
function combineManaFaces(faceResults) {
  const s = new Set(), o = new Set();
  for (const r of faceResults) {
    for (const c of r.sustained) s.add(c);
    for (const c of r.oneShot) o.add(c);
  }
  if (s.size) return { pm: canonManaColors(s), rt: 0 };
  if (o.size) return { pm: canonManaColors(o), rt: 1 };
  return { pm: '', rt: 0 };
}
// ===== END SHARED MANA-PRODUCTION LOGIC =====

// Faces whose abilities are all usable from the same card. Modal double-faced
// cards (spell // land), split cards and adventures can be played as either
// half, so their production is combined. Transforming cards only reach their
// back face after transforming, so only the front face counts for those.
const UNION_FACE_LAYOUTS = new Set(['modal_dfc', 'split', 'adventure']);

function manaProductionFor(card) {
  const faces = (card.card_faces && card.card_faces.length) ? card.card_faces : null;
  if (!faces) return combineManaFaces([analyzeManaFace(card.type_line, card.oracle_text)]);
  const used = UNION_FACE_LAYOUTS.has(card.layout) ? faces : [faces[0]];
  return combineManaFaces(used.map(f => analyzeManaFace(f.type_line || card.type_line, f.oracle_text)));
}

function encodePips(manaCost) {
  if (!manaCost) return '';
  const halfPips = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const symbolRe = /\{([^}]+)\}/g;
  let match;
  while ((match = symbolRe.exec(manaCost))) {
    const sym = match[1];
    if (sym === 'C') { halfPips.C += 2; continue; }
    const colors = sym.split('/').filter(s => 'WUBRG'.includes(s));
    if (!colors.length) continue;
    const share = 2 / colors.length;
    for (const c of colors) halfPips[c] += share;
  }
  let out = '';
  for (const c of ['W', 'U', 'B', 'R', 'G', 'C']) {
    const v = Math.round(halfPips[c]);
    if (v > 0) out += c + v;
  }
  return out;
}

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
  const { pm, rt } = manaProductionFor(card);
  return [name, typeLine, oracleText, manaCost, colorIdentity, cmc, pips, rarity, pm, rt];
}

function readInputAsText(path) {
  const buf = readFileSync(path);
  const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  const raw = isGzip ? gunzipSync(buf) : buf;
  return { text: raw.toString('utf8'), wasGzipped: isGzip };
}

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
    if (card.layout === 'token' || card.layout === 'art_series') continue;
    if (seenNames.has(card.name)) continue;
    seenNames.add(card.name);

    cards.push(cardToTuple(card));
    if (card.game_changer === true) gc.push(card.name);
    if (card.legalities && card.legalities.commander === 'banned') banned.push(card.name);
  }

  if (cards.length < MIN_PLAUSIBLE_CARD_COUNT) {
    throw new Error(`Only parsed ${cards.length} cards, expected at least ${MIN_PLAUSIBLE_CARD_COUNT}. Refusing to write output.`);
  }
  const producerCount = cards.filter(t => t[8]).length;
  const oneShotCount = cards.filter(t => t[9] === 1).length;
  if (producerCount < MIN_PLAUSIBLE_PRODUCER_COUNT) {
    throw new Error(`Only ${producerCount} cards were detected as mana producers, expected at least ${MIN_PLAUSIBLE_PRODUCER_COUNT}. Refusing to write output.`);
  }

  const payload = { cards, gc, banned };
  const json = JSON.stringify(payload);
  const gzipped = gzipSync(Buffer.from(json, 'utf8'));
  const b64 = gzipped.toString('base64');

  writeFileSync(outPath, b64, 'utf8');
  return { cardCount: cards.length, gcCount: gc.length, bannedCount: banned.length, producerCount, oneShotCount, b64Length: b64.length };
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
