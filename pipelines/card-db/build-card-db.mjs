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
// Card tuple (16 fields):
//   [name, typeLine, oracleText, manaCost, colorIdentity, manaValue, pips,
//    rarity, producedMana, oneShotFlag, power, toughness, notCommanderLegal,
//    loyalty, backOracleText, backTypeLine]
// The last two are what the Mana Base: Cost vs. Production panel needs:
//   producedMana - colors of mana the card can make ("" if none), e.g. "WG"
//   oneShotFlag  - 1 if that mana is one-time only (Dark Ritual, Lotus Petal),
//                  so it's listed separately instead of counted as a source
// The last three (added Oct 2026) are what the Key Interactions panel needs:
//   power, toughness - printed values as text ("0", "4", "*", "1+*"); "" for non-creatures. Front face for
//                      multi-face cards.
//   notCommanderLegal - 1 if Scryfall lists the card as not_legal in Commander (Un-cards, joke and
//                      playtest cards, Conspiracy, Schemes and similar), so suggestions never offer them.
//
// The last three (added Oct 2026) are what the Planeswalker plan and two-faced cards need:
//   loyalty        - starting loyalty as text ("4", "X"); "" for anything that is not a planeswalker. Front face.
//   backOracleText - rules text of the second face of a two-faced card ("" otherwise), so the back side can be read.
//   backTypeLine   - type line of that second face ("" otherwise).
//
// An earlier build left these out entirely and the panel read other fields
// (mana value, rarity) in their place, which broke it. They are worked out
// here from each card's rules text by src/shared/mana-production.ts (shared with the engine).

import { readInputAsText, writeCompressedJson } from "../lib/io.mjs";
import { isMain } from "../lib/cli.mjs";
import { analyzeManaFace, combineManaFaces } from "../../src/shared/mana-production.ts";

const MIN_PLAUSIBLE_CARD_COUNT = 5000;
// The real figure is ~2,000 cards that produce mana. If far fewer come out,
// the production logic has broken (the way the gzip bug once produced zero
// cards) -- fail loudly rather than publish a database that empties the panel.
const MIN_PLAUSIBLE_PRODUCER_COUNT = 800;
// About 14,000 cards have a power; about 1,000+ are not Commander-legal. Far fewer means a field went missing.
const MIN_PLAUSIBLE_POWER_COUNT = 5000;
const MIN_PLAUSIBLE_NOT_LEGAL_COUNT = 300;
// About 700+ planeswalkers carry a loyalty and about 2,000 two-faced cards carry a back face.
const MIN_PLAUSIBLE_LOYALTY_COUNT = 300;
const MIN_PLAUSIBLE_BACK_FACE_COUNT = 800;

// Faces whose abilities are all usable from the same card. Modal double-faced
// cards (spell // land), split cards and adventures can be played as either
// half, so their production is combined. Transforming cards only reach their
// back face after transforming, so only the front face counts for those.
const UNION_FACE_LAYOUTS = new Set(["modal_dfc", "split", "adventure"]);

function manaProductionFor(card) {
  const faces = card.card_faces && card.card_faces.length ? card.card_faces : null;
  if (!faces) return combineManaFaces([analyzeManaFace(card.type_line, card.oracle_text)]);
  const used = UNION_FACE_LAYOUTS.has(card.layout) ? faces : [faces[0]];
  return combineManaFaces(
    used.map((f) => analyzeManaFace(f.type_line || card.type_line, f.oracle_text)),
  );
}

function encodePips(manaCost) {
  if (!manaCost) return "";
  const halfPips = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const symbolRe = /\{([^}]+)\}/g;
  let match;
  while ((match = symbolRe.exec(manaCost))) {
    const sym = match[1];
    if (sym === "C") {
      halfPips.C += 2;
      continue;
    }
    const colors = sym.split("/").filter((s) => "WUBRG".includes(s));
    if (!colors.length) continue;
    const share = 2 / colors.length;
    for (const c of colors) halfPips[c] += share;
  }
  let out = "";
  for (const c of ["W", "U", "B", "R", "G", "C"]) {
    const v = Math.round(halfPips[c]);
    if (v > 0) out += c + v;
  }
  return out;
}

function cardToTuple(card) {
  const face = card.card_faces && card.card_faces.length ? card.card_faces[0] : card;
  const name = card.name || "";
  const typeLine = card.type_line || face.type_line || "";
  const oracleText = card.oracle_text || face.oracle_text || "";
  const manaCost = card.mana_cost || face.mana_cost || "";
  const colorIdentity = (card.color_identity || []).join("");
  const cmc = typeof card.cmc === "number" ? card.cmc : 0;
  const pips = encodePips(manaCost);
  const rarity = card.rarity || "";
  const { pm, rt } = manaProductionFor(card);
  const power = String(card.power != null ? card.power : face.power != null ? face.power : "");
  const toughness = String(
    card.toughness != null ? card.toughness : face.toughness != null ? face.toughness : "",
  );
  const notLegal = card.legalities && card.legalities.commander === "not_legal" ? 1 : 0;
  const loyalty = String(
    card.loyalty != null ? card.loyalty : face.loyalty != null ? face.loyalty : "",
  );
  const back = card.card_faces && card.card_faces.length > 1 ? card.card_faces[1] : null;
  const backText = back ? back.oracle_text || "" : "";
  const backType = back ? back.type_line || "" : "";
  return [
    name,
    typeLine,
    oracleText,
    manaCost,
    colorIdentity,
    cmc,
    pips,
    rarity,
    pm,
    rt,
    power,
    toughness,
    notLegal,
    loyalty,
    backText,
    backType,
  ];
}

/** @param {string} bulkFilePath @param {string} outPath */
export function build(bulkFilePath, outPath) {
  const { text, wasGzipped } = readInputAsText(bulkFilePath);
  console.log(
    wasGzipped
      ? "Input was gzip-compressed -- decompressed before parsing."
      : "Input was plain text.",
  );

  const cards = [];
  const gc = [];
  const banned = [];
  const seenNames = new Set();

  const lines = text.split("\n");
  for (const [index, rawLine] of lines.entries()) {
    const trimmed = rawLine.trim().replace(/,$/, "");
    if (!trimmed || trimmed === "[" || trimmed === "]") continue;
    let card;
    try {
      card = JSON.parse(trimmed);
    } catch (cause) {
      throw new Error(`Malformed card input at line ${index + 1}`, { cause });
    }
    if (!card || card.object !== "card") continue;
    if (card.layout === "token" || card.layout === "art_series") continue;
    if (seenNames.has(card.name)) continue;
    seenNames.add(card.name);

    cards.push(cardToTuple(card));
    if (card.game_changer === true) gc.push(card.name);
    if (card.legalities && card.legalities.commander === "banned") banned.push(card.name);
  }

  if (cards.length < MIN_PLAUSIBLE_CARD_COUNT) {
    throw new Error(
      `Only parsed ${cards.length} cards, expected at least ${MIN_PLAUSIBLE_CARD_COUNT}. Refusing to write output.`,
    );
  }
  const producerCount = cards.filter((t) => t[8]).length;
  const oneShotCount = cards.filter((t) => t[9] === 1).length;
  if (producerCount < MIN_PLAUSIBLE_PRODUCER_COUNT) {
    throw new Error(
      `Only ${producerCount} cards were detected as mana producers, expected at least ${MIN_PLAUSIBLE_PRODUCER_COUNT}. Refusing to write output.`,
    );
  }

  const powerCount = cards.filter((t) => t[10] !== "").length;
  const notLegalCount = cards.filter((t) => t[12] === 1).length;
  if (powerCount < MIN_PLAUSIBLE_POWER_COUNT) {
    throw new Error(
      `Only ${powerCount} cards have a power value, expected at least ${MIN_PLAUSIBLE_POWER_COUNT}. Refusing to write output.`,
    );
  }
  if (notLegalCount < MIN_PLAUSIBLE_NOT_LEGAL_COUNT) {
    throw new Error(
      `Only ${notLegalCount} cards are flagged not Commander-legal, expected at least ${MIN_PLAUSIBLE_NOT_LEGAL_COUNT}. Refusing to write output.`,
    );
  }

  const loyaltyCount = cards.filter((t) => t[13] !== "").length;
  const backFaceCount = cards.filter((t) => t[14] !== "").length;
  if (loyaltyCount < MIN_PLAUSIBLE_LOYALTY_COUNT) {
    throw new Error(
      `Only ${loyaltyCount} cards have a loyalty value, expected at least ${MIN_PLAUSIBLE_LOYALTY_COUNT}. Refusing to write output.`,
    );
  }
  if (backFaceCount < MIN_PLAUSIBLE_BACK_FACE_COUNT) {
    throw new Error(
      `Only ${backFaceCount} cards have a back-face text, expected at least ${MIN_PLAUSIBLE_BACK_FACE_COUNT}. Refusing to write output.`,
    );
  }

  const payload = { cards, gc, banned };
  const b64Length = writeCompressedJson(outPath, payload);
  return {
    cardCount: cards.length,
    gcCount: gc.length,
    bannedCount: banned.length,
    producerCount,
    oneShotCount,
    powerCount,
    notLegalCount,
    loyaltyCount,
    backFaceCount,
    b64Length,
  };
}

if (isMain(import.meta.url)) {
  const [, , bulkFilePath, outPath] = process.argv;
  if (!bulkFilePath) {
    console.error("Usage: node build-card-db.mjs <scryfall-bulk-file> [output-file]");
    process.exit(1);
  }
  try {
    const stats = build(bulkFilePath, outPath || "card-db-compressed.b64");
    console.log("Build complete:", stats);
  } catch (err) {
    console.error("Build failed:", err.message);
    process.exit(1);
  }
}
