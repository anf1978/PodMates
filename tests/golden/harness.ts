// Golden harness: runs the engine modules on every Try-a-Deck sample with pinned
// card, Spellbook and win-rate fixtures. No HTML, DOM, network or app startup.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { buildLookupIndexes, matchDecklist } from "../../src/cards/lookup.ts";
import type { MatchedDecklist } from "../../src/cards/lookup.ts";
import { parseDecklist } from "../../src/cards/parse-decklist.ts";
import type { CardRecord } from "../../src/cards/tuple.ts";
import {
  analyzeDeck,
  buildSpellbookIndex,
  createEngineContext,
  detectWinCondition,
  parseCommanderField,
  scoreConsistency,
  scoreDisruption,
  scorePowerLevel,
  scoreSpeed,
  scoreVersatility,
} from "../../src/engine/index.ts";
import type {
  CommanderTierRecord,
  DeckAnalysis,
  EngineContext,
  SpellbookSnapshot,
} from "../../src/engine/index.ts";

export const fixtureUrl = new URL("./fixtures/", import.meta.url);

export interface Sample {
  key: string;
  commander: string;
  decklist: string;
}

export interface SampleMatch extends MatchedDecklist {
  commanders: string[];
}

export interface SampleResult {
  commanders: string[];
  notFound: string[];
  fuzzyMatches: { typed: string; matched: string }[];
  analysis: DeckAnalysis;
  axes: Record<"speed" | "consistency" | "versatility" | "disruption" | "powerLevel", number>;
}

export interface Harness {
  samples: Sample[];
  cards: CardRecord[];
  context: EngineContext;
  matchSample(sample: Sample): SampleMatch;
  analyzeSample(sample: Sample): SampleResult;
}

export function readDataset<T>(name: string): T {
  return JSON.parse(
    readFileSync(new URL(`../../public/data/${name}.json`, import.meta.url), "utf8"),
  ) as T;
}

export function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(name, fixtureUrl), "utf8")) as T;
}

export function decodeSpellbook(): SpellbookSnapshot {
  return JSON.parse(
    gunzipSync(Buffer.from(readDataset<string>("SPELLBOOK_SNAPSHOT_B64"), "base64")).toString(
      "utf8",
    ),
  ) as SpellbookSnapshot;
}

export function createHarness(
  cards: CardRecord[] = readFixture("cards.json"),
  spellbook: SpellbookSnapshot = readFixture("spellbook.json"),
  winRates: CommanderTierRecord[] = readFixture("winrates.json"),
): Harness {
  const samples = readDataset<Sample[]>("TRY_A_DECK_OPTIONS");
  const indexes = buildLookupIndexes(cards);
  const context = createEngineContext({
    cards,
    spellbook: buildSpellbookIndex(spellbook),
    winRates,
  });
  function matchSample(sample: Sample): SampleMatch {
    const parsed = parseDecklist(sample.decklist);
    const matches = matchDecklist(parsed.entries, cards, indexes);
    const commanders = parseCommanderField(context, sample.commander, matches.matched);
    return { ...matches, commanders };
  }
  return {
    samples,
    cards,
    context,
    matchSample,
    analyzeSample(sample) {
      const { matched, notFound, fuzzyMatches, commanders } = matchSample(sample);
      const analysis = analyzeDeck(context, matched, commanders);
      const winCons = detectWinCondition(analysis);
      const hasSpecificWinCon = winCons.length > 0 && winCons[0]?.confidence !== "fallback";
      return {
        commanders,
        notFound,
        fuzzyMatches,
        analysis,
        axes: {
          speed: scoreSpeed(analysis, hasSpecificWinCon),
          consistency: scoreConsistency(analysis),
          versatility: scoreVersatility(analysis, winCons.length),
          disruption: scoreDisruption(analysis),
          powerLevel: scorePowerLevel(analysis),
        },
      };
    },
  };
}

export function stableJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item: unknown) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        );
      }
      return item;
    },
    2,
  );
}
