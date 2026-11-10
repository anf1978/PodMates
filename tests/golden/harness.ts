// Typed entry point for golden tests against the live inline engine.
// All external card and Spellbook data comes from committed fixtures.
import { readFileSync } from "node:fs";
import { createEngine, fixtureUrl } from "./source.mjs";

export interface Card {
  n: string;
  t: string;
  o: string;
  c: string;
  ci: string;
  m: number;
  p: string;
  r: string;
  g: boolean;
  b: boolean;
  pm?: string;
  rt?: boolean;
  pw?: string;
  tg?: string;
  x?: boolean;
  ly?: string;
  ob?: string;
  bt?: string;
}

export interface Sample {
  key: string;
  commander: string;
  decklist: string;
}

interface MatchedCard {
  qty: number;
  card: Card;
  originalName: string;
}

export interface SampleResult {
  commanders: string[];
  notFound: string[];
  fuzzyMatches: { typed: string; matched: string }[];
  analysis: Record<string, unknown>;
  axes: Record<"speed" | "consistency" | "versatility" | "disruption" | "powerLevel", number>;
}

export interface Engine {
  samples: Sample[];
  analyzeDeck(matched: MatchedCard[], commanders?: string[]): Record<string, unknown>;
  analyzeSample(sample: Sample): SampleResult;
}

export function createHarness(html?: string): Engine {
  return createEngine(
    JSON.parse(readFileSync(new URL("cards.json", fixtureUrl), "utf8")),
    JSON.parse(readFileSync(new URL("spellbook.json", fixtureUrl), "utf8")),
    html,
  );
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
