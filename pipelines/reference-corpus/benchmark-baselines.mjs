// Rebuilds STAPLES_BASELINE and MANABASE_BASELINE (the "staples check" and "mana base" benchmarks
// on the Deck Chart) from the Try-a-Deck sample decks, the way the Nov 3, 2026 refit did.
//
// Recovered, not invented: the aggregation below is a line-for-line port of the Python step that
// produced the committed files (inline script 7 in recovered/inline-python-patches-and-calcs.txt).
// The per-deck step it read (`feat174.json`, from the lost `pw160.cjs`) is rebuilt from the
// engine functions the app itself uses. `benchmark-baselines.test.mjs` proves the result is
// byte-identical to the committed public/data files, so any drift fails CI.
//
// Usage: node pipelines/reference-corpus/benchmark-baselines.mjs <out-dir> [--all-samples]
// Writes <out-dir>/STAPLES_BASELINE.json and MANABASE_BASELINE.json. Never writes public/data:
// adopting a new fit moves the Deck Chart for every deck and is a deliberate, reviewed change.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { decodeCardDatabase } from "../../src/cards/db-codec.js";
import { buildLookupIndexes, matchDecklist } from "../../src/cards/lookup.ts";
import { parseDecklist } from "../../src/cards/parse-decklist.ts";
import {
  analyzeDeck,
  buildSpellbookIndex,
  computeManaBaseBenchmark,
  createEngineContext,
  parseCommanderField,
} from "../../src/engine/index.ts";
import { isMain } from "../lib/cli.mjs";

/** The 12 staples categories, in the committed file's order. */
export const STAPLES_KEYS = [
  "sacOutlets",
  "ramp",
  "tutor",
  "removal",
  "wipe",
  "draw",
  "counterMagic",
  "reanimate",
  "discard",
  "extraTurn",
  "stax",
  "protection",
];

/** Sample decks that were not part of the Nov 3, 2026 fit (174 decks). They are also absent
 * from PRECON_FINGERPRINTS. Including them is a new fit, not a rebuild. */
export const EXCLUDED_FROM_NOV_3_FIT = [
  "cmd2026-federationfleet",
  "cmd2026-wearetheborg",
  "cmd2026-klingonfury",
  "cmd2026-landingparty",
];

/**
 * @typedef {{ key: string, archetype: string, commander: string, decklist: string }} SampleDeck
 * @typedef {{ identity: string, nc: number, nb: number, fix: number }} ManaBaseFeature
 * @typedef {{ k: string, arch: string, st: Record<string, number>, lands: number,
 *   bm: ManaBaseFeature | null }} DeckFeatures
 */

/** Python's statistics.median: the middle value, or the mean of the two middle values.
 * @param {number[]} values */
export function median(values) {
  if (!values.length) throw new Error("median of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Python's round(value, 3). Python rounds the float's exact binary value, so 0.6085 (stored as
 * 0.608500000000000040…) goes up, and only a true half goes to the even neighbour.
 * toFixed(40) prints that exact value (it is exact for doubles at this precision).
 * @param {number} value */
export function roundHalfEven3(value) {
  if (!(value >= 0)) throw new Error(`expected a non-negative ratio, got ${value}`);
  const [whole, frac] = value.toFixed(40).split(".");
  const kept = BigInt(whole + frac.slice(0, 3));
  const rest = frac.slice(3);
  const half = "5".padEnd(rest.length, "0");
  const up = rest > half || (rest === half && kept % 2n === 1n);
  return Number(up ? kept + 1n : kept) / 1000;
}

/**
 * Per-deck inputs, as the page computed them: the analysed counts, the sample's own archetype
 * label and the mana-base benchmark's fixing figures.
 * @param {SampleDeck[]} samples
 * @param {{ cards: any[], spellbook: any, winRates: any[] }} data
 * @returns {DeckFeatures[]}
 */
export function deckFeatures(samples, { cards, spellbook, winRates }) {
  const indexes = buildLookupIndexes(cards);
  const ctx = createEngineContext({ cards, spellbook: buildSpellbookIndex(spellbook), winRates });
  const emptyBaseline = { byIdentity: {}, byCount: {} };
  return samples.map((sample) => {
    const { matched } = matchDecklist(parseDecklist(sample.decklist).entries, cards, indexes);
    const commanders = parseCommanderField(ctx, sample.commander, matched);
    const agg = /** @type {Record<string, any>} */ (analyzeDeck(ctx, matched, commanders));
    // Same commander-card lookup as src/features/deck-chart/run-analysis.ts.
    const commanderCards = commanders
      .map(
        (name) => matched.find((m) => m.card.n === name)?.card || cards.find((c) => c.n === name),
      )
      .filter(Boolean);
    const bm = computeManaBaseBenchmark(emptyBaseline, matched, commanderCards);
    return {
      k: sample.key,
      arch: sample.archetype,
      st: Object.fromEntries(STAPLES_KEYS.map((key) => [key, agg[key] || 0])),
      lands: agg.landCount,
      bm: bm && {
        identity: bm.identity,
        nc: bm.numColors,
        nb: bm.nonbasicCount,
        fix: bm.avgFixingRatio,
      },
    };
  });
}

/**
 * The aggregation from the Nov 3 refit: per-archetype medians of the staples counts, and
 * mana-base medians bucketed by exact colour identity and by colour count.
 * @param {DeckFeatures[]} rows
 */
export function buildBaselines(rows) {
  /** @param {DeckFeatures[]} list @param {(row: DeckFeatures) => string} keyOf */
  const groupBy = (list, keyOf) => {
    /** @type {Map<string, DeckFeatures[]>} */
    const groups = new Map();
    for (const row of list) {
      const key = keyOf(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return groups;
  };

  /** @type {Record<string, Record<string, number>>} */
  const baselines = {};
  for (const [archetype, decks] of groupBy(rows, (row) => row.arch)) {
    /** @type {Record<string, number>} */
    const bucket = { n: decks.length };
    for (const key of STAPLES_KEYS) bucket[key] = median(decks.map((d) => d.st[key]));
    baselines[archetype] = bucket;
  }

  /** @param {DeckFeatures[]} decks */
  const manaBucket = (decks) => ({
    n: decks.length,
    medianFixingRatio: roundHalfEven3(median(decks.map((d) => d.bm.fix))),
    medianNonbasicCount: median(decks.map((d) => d.bm.nb)),
    medianLandCount: median(decks.map((d) => d.lands)),
  });
  const coloured = rows.filter((row) => row.bm);
  const byIdentity = {};
  for (const [identity, decks] of groupBy(coloured, (row) => row.bm.identity)) {
    byIdentity[identity] = manaBucket(decks);
  }
  const byCount = {};
  const counts = groupBy(coloured, (row) => String(row.bm.nc));
  for (const count of [...counts.keys()].sort()) byCount[count] = manaBucket(counts.get(count));

  return {
    staples: { keys: STAPLES_KEYS, baselines },
    manabase: { byIdentity, byCount },
  };
}

/** Reads the committed datasets the app loads (full card DB, Spellbook, win-rates). */
function readPublishedData() {
  const read = (name) =>
    JSON.parse(readFileSync(new URL(`../../public/data/${name}.json`, import.meta.url), "utf8"));
  return {
    samples: read("TRY_A_DECK_OPTIONS"),
    cardsPayload: read("cards"),
    spellbook: JSON.parse(
      gunzipSync(Buffer.from(read("SPELLBOOK_SNAPSHOT_B64"), "base64")).toString("utf8"),
    ),
    winRates: read("winrates"),
  };
}

/** @param {string[]} argv */
async function main(argv) {
  const outDir = argv.find((arg) => !arg.startsWith("--"));
  if (!outDir) throw new Error("Usage: benchmark-baselines.mjs <out-dir> [--all-samples]");
  const { samples, cardsPayload, spellbook, winRates } = readPublishedData();
  const cards = await decodeCardDatabase(cardsPayload);
  const chosen = argv.includes("--all-samples")
    ? samples
    : samples.filter((s) => !EXCLUDED_FROM_NOV_3_FIT.includes(s.key));
  const { staples, manabase } = buildBaselines(
    deckFeatures(chosen, { cards, spellbook, winRates }),
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "STAPLES_BASELINE.json"), `${JSON.stringify(staples)}\n`);
  writeFileSync(join(outDir, "MANABASE_BASELINE.json"), `${JSON.stringify(manabase)}\n`);
  console.log(`Wrote baselines for ${chosen.length} sample decks to ${outDir}`);
}

if (isMain(import.meta.url)) await main(process.argv.slice(2));
