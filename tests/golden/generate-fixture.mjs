// Regenerates pinned data from the published card DB and extracted Spellbook, then
// proves the subset produces the same complete analyses as the full databases.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { decodeCardDatabase } from "../../src/cards/db-codec.js";
import { HARD_COMBOS } from "../../src/data/combos.ts";
import { createHarness, decodeSpellbook, fixtureUrl, readDataset, readFixture } from "./harness.ts";

const cards = await decodeCardDatabase(readDataset("cards"));
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
const pinnedCards = cards.filter((card) => needed.has(card.n));
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
