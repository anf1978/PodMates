// Regenerates pinned data from the published card DB and extracted Spellbook, then
// proves the subset produces the same complete analyses as the full databases.
//
// `--add <cards.json>` (used by the precon importer): take cards from that newer card DB, but keep
// every card already pinned exactly as pinned, so existing samples analyse exactly as before and
// only newly added samples bring new cards. Parity is checked against that same overlaid DB.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodeCardDatabase } from "../../src/cards/db-codec.js";
import { HARD_COMBOS } from "../../src/data/combos.ts";
import { createHarness, decodeSpellbook, fixtureUrl, readDataset, readFixture } from "./harness.ts";

const addFrom = process.argv.includes("--add")
  ? process.argv[process.argv.indexOf("--add") + 1]
  : null;
const cards = addFrom
  ? overlayPinned(await decodeCardDatabase(JSON.parse(readFileSync(addFrom, "utf8"))))
  : await decodeCardDatabase(readDataset("cards"));

/** The newer DB with each already-pinned card replaced by its pinned version (and pinned cards
 * the newer DB lacks kept), so pinned samples cannot change. */
function overlayPinned(newer) {
  const pinned = new Map(readFixture("cards.json").map((card) => [card.n, card]));
  const merged = newer.map((card) => pinned.get(card.n) || card);
  const names = new Set(newer.map((card) => card.n));
  for (const [name, card] of pinned) if (!names.has(name)) merged.push(card);
  return merged;
}
const spellbook = decodeSpellbook();
const winRates = readFixture("winrates.json");
const full = createHarness(cards, spellbook, winRates);
const deckNames = full.samples.map(
  (sample) =>
    new Set(
      full
        .matchSample(sample)
        .matched.filter((m) => !m.card.b)
        .map((m) => m.card.n),
    ),
);
const needed = new Set();
for (const sample of full.samples) {
  const match = full.matchSample(sample);
  assert.deepEqual(Array.from(match.notFound), [], `Unmatched cards in ${sample.key}`);
  for (const m of match.matched) needed.add(m.card.n);
  for (const commander of match.commanders) {
    const card = full.cards.find((c) => c.n === commander);
    if (card) needed.add(card.n);
  }
}

// Keep complete AND one-card-away rows. Preserve row/name/outcome order because
// the engine uses insertion order to break ties between equally ranked combos.
const rows = spellbook.c.filter((row) => {
  const names = row[0].map((i) => spellbook.n[i]);
  return deckNames.some((deck) => names.filter((name) => !deck.has(name)).length <= 1);
});
for (const row of rows) for (const i of row[0]) needed.add(spellbook.n[i]);
for (const combo of HARD_COMBOS) {
  if (
    deckNames.some((deck) => combo.s.filter((slot) => !slot.some((n) => deck.has(n))).length <= 1)
  ) {
    for (const slot of combo.s) for (const name of slot) needed.add(name);
  }
}

const usedNames = new Set(rows.flatMap((row) => row[0]));
const usedOutcomes = new Set(rows.map((row) => row[2]));
const nameIndices = [...usedNames].sort((a, b) => a - b);
const outcomeIndices = [...usedOutcomes].sort((a, b) => a - b);
const nameMap = new Map(nameIndices.map((old, i) => [old, i]));
const outcomeMap = new Map(outcomeIndices.map((old, i) => [old, i]));
const pinnedSpellbook = {
  ...spellbook,
  n: nameIndices.map((i) => spellbook.n[i]),
  o: outcomeIndices.map((i) => spellbook.o[i]),
  c: rows.map(([names, code, outcome, popularity]) => [
    names.map((i) => nameMap.get(i)),
    code,
    outcomeMap.get(outcome),
    popularity,
  ]),
};
// With --add, the pinned cards stay first and in their order (tests digest the original 7621), and
// cards new to the pin are appended.
const previous = addFrom ? readFixture("cards.json") : [];
const previousNames = new Set(previous.map((card) => card.n));
const pinnedCards = [
  ...previous,
  ...cards.filter((card) => needed.has(card.n) && !previousNames.has(card.n)),
];
const pinned = createHarness(pinnedCards, pinnedSpellbook, winRates);
for (const sample of full.samples) {
  assert.equal(
    JSON.stringify(pinned.analyzeSample(sample)),
    JSON.stringify(full.analyzeSample(sample)),
    `Fixture changes analysis for ${sample.key}`,
  );
}

mkdirSync(fixtureUrl, { recursive: true });
for (const [file, value] of [
  ["cards.json", pinnedCards],
  ["spellbook.json", pinnedSpellbook],
]) {
  writeFileSync(new URL(file, fixtureUrl), JSON.stringify(value) + "\n");
}
console.log(
  `Pinned ${pinnedCards.length}/${cards.length} cards and ${rows.length}/${spellbook.c.length} Spellbook rows for ${full.samples.length} decks; full-data parity verified.`,
);
