import { expect, it } from "vitest";
import type { CardRecord } from "../../src/cards/tuple.ts";
import type { CommanderTierRecord, SpellbookSnapshot } from "../../src/engine/index.ts";
import { createHarness, readFixture, stableJson } from "./harness.ts";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
}

// Two complete library passes exceed Vitest's default 5s on hosted runners.
it("analyses every sample without mutating its inputs or keeping state between runs", () => {
  const original = createHarness();
  const frozen = createHarness(
    deepFreeze(readFixture<CardRecord[]>("cards.json")),
    deepFreeze(readFixture<SpellbookSnapshot>("spellbook.json")),
    deepFreeze(readFixture<CommanderTierRecord[]>("winrates.json")),
  );
  const first = original.samples.map((sample) => stableJson(original.analyzeSample(sample)));
  // Reverse order: a result must not depend on which decks were analysed before it.
  const second = [...frozen.samples]
    .reverse()
    .map((sample) => stableJson(frozen.analyzeSample(sample)))
    .reverse();
  expect(second).toEqual(first);
}, 15_000);
