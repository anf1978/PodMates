// Runs only explicitly marked, DOM-free legacy source. Fixture generation and
// golden tests share this loader; neither executes app startup or network code.
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { gunzipSync } from "node:zlib";

export const htmlUrl = new URL("../../index.html", import.meta.url);
export const fixtureUrl = new URL("./fixtures/", import.meta.url);

export function extractBlock(html, name) {
  const start = `/* @golden:${name}:start */`;
  const end = `/* @golden:${name}:end */`;
  const parts = html.split(start);
  if (
    parts.length !== 2 ||
    html.split(end).length !== 2 ||
    html.indexOf(end) < html.indexOf(start)
  ) {
    throw new Error(`Expected exactly one golden block: ${name}`);
  }
  return parts[1].split(end)[0];
}

export function decodeEmbedded(html, name) {
  const match = html.match(new RegExp(`const ${name} = ["']([^"']+)["'];`));
  if (!match) throw new Error(`Missing embedded dataset: ${name}`);
  return JSON.parse(gunzipSync(Buffer.from(match[1], "base64")).toString("utf8"));
}

export function createEngine(cards, spellbook, html = readFileSync(htmlUrl, "utf8")) {
  const context = createContext({});
  for (const name of ["engine", "lookup", "corpus", "samples", "legality", "combo-outcomes"]) {
    runInContext(extractBlock(html, name), context, {
      filename: `index.html#golden:${name}`,
      timeout: 10_000,
    });
  }
  // Clone into the VM so legacy memoization cannot mutate the pinned input.
  runInContext(
    `var CARD_DB = ${JSON.stringify(cards)};
     SPELLBOOK_INDEX = buildSpellbookIndex(${JSON.stringify(spellbook)});
     const goldenIndexes = buildLookupIndexes(CARD_DB);`,
    context,
    { timeout: 10_000 },
  );
  return runInContext(
    `({
      samples: TRY_A_DECK_OPTIONS,
      cards: CARD_DB,
      hardCombos: HARD_COMBOS,
      analyzeDeck,
      matchSample(sample) {
        const parsed = parseDecklist(sample.decklist);
        const matches = matchDecklist(parsed.entries, CARD_DB, goldenIndexes);
        const commanders = parseCommanderField(sample.commander, matches.matched);
        return { ...matches, commanders };
      },
      analyzeSample(sample) {
        const { matched, notFound, fuzzyMatches, commanders } = this.matchSample(sample);
        const analysis = analyzeDeck(matched, commanders);
        const winCons = detectWinCondition(analysis);
        const hasSpecificWinCon = winCons.length > 0 && winCons[0].confidence !== 'fallback';
        return {
          commanders, notFound, fuzzyMatches, analysis,
          axes: {
            speed: scoreSpeed(analysis, hasSpecificWinCon),
            consistency: scoreConsistency(analysis),
            versatility: scoreVersatility(analysis, winCons.length),
            disruption: scoreDisruption(analysis),
            powerLevel: scorePowerLevel(analysis)
          }
        };
      }
    })`,
    context,
  );
}

export async function decodeCards(html) {
  const context = createContext({
    atob,
    DecompressionStream,
    TextDecoder,
    setTimeout,
    clearTimeout,
  });
  const match = html.match(/const CARD_DB_COMPRESSED_B64 = ["']([^"']+)["'];/);
  if (!match) throw new Error("Missing embedded card database");
  runInContext(
    `const CARD_DB_COMPRESSED_B64 = ${JSON.stringify(match[1])};\n${extractBlock(html, "decode")}`,
    context,
  );
  return await runInContext("decompressCardDB()", context);
}
