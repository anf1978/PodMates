// Finds official Commander precons that Try a Deck does not have yet and turns them into Try-a-Deck
// entries, from MTGJSON's public deck files (the same source PriceScry already uses).
//
// Only decks released on or after IMPORT_SINCE are considered, and only when every card is already
// in the card database (a deck still waiting for cards is reported and picked up on a later run).
// Labels (archetype, style, tagline) are suggestions for a person to review in the pull request
// that the precon-import workflow opens; nothing here merges by itself.
//
// Usage: node pipelines/precons/import-precons.mjs --cards <cards.json> --report <report.md>
//          [--change-doc-dir docs/changes] [--since YYYY-MM-DD] [--today YYYY-MM-DD]
// Appends to public/data/TRY_A_DECK_OPTIONS.json and refreshes TRY_A_DECK_METADATA.json and their
// manifest entries. Traffic: two list files plus one file per new deck, 1 s apart, identified.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { decodeCardDatabase } from "../../src/cards/db-codec.js";
import { buildLookupIndexes, matchDecklist } from "../../src/cards/lookup.ts";
import { parseDecklist } from "../../src/cards/parse-decklist.ts";
import { computeArchetypeMatch } from "../../src/engine/benchmarks.ts";
import {
  analyzeDeck,
  buildSpellbookIndex,
  createEngineContext,
  parseCommanderField,
} from "../../src/engine/index.ts";
import { isMain } from "../lib/cli.mjs";
import { updateManifest, writeDeckMetadata } from "../lib/dataset-manifest.mjs";
import { getJson, sleep } from "../lib/http.mjs";

export const IMPORT_SINCE = "2026-11-01";
export const MTGJSON = "https://mtgjson.com/api/v5";
export const USER_AGENT = "PodMatesPreconImport/1.0 (+https://github.com/anf1978/PodMates)";

/**
 * @typedef {{ code: string, fileName: string, name: string, releaseDate: string, type: string }} DeckListEntry
 * @typedef {{ name: string, count: number }} DeckCard
 * @typedef {{ name: string, releaseDate?: string, commander?: DeckCard[], mainBoard?: DeckCard[] }} DeckFile
 * @typedef {{ key: string, flavorName?: string, commander: string, decklist: string, source?: string,
 *   archetype?: string, [field: string]: unknown }} Sample
 * @typedef {(url: string) => Promise<any>} FetchJson
 */

/** Lower-case letters and digits only: "Science!" -> "science". */
export const slug = (name) =>
  String(name)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const COLOUR_NAMES = {
  "": "Colorless",
  W: "Mono-White",
  U: "Mono-Blue",
  B: "Mono-Black",
  R: "Mono-Red",
  G: "Mono-Green",
  WU: "Azorius",
  UB: "Dimir",
  BR: "Rakdos",
  RG: "Gruul",
  WG: "Selesnya",
  WB: "Orzhov",
  UR: "Izzet",
  BG: "Golgari",
  WR: "Boros",
  UG: "Simic",
  WUB: "Esper",
  UBR: "Grixis",
  BRG: "Jund",
  WRG: "Naya",
  WUG: "Bant",
  WBG: "Abzan",
  WUR: "Jeskai",
  UBG: "Sultai",
  WBR: "Mardu",
  URG: "Temur",
  WUBR: "Four-Color",
  UBRG: "Four-Color",
  WBRG: "Four-Color",
  WURG: "Four-Color",
  WUBG: "Four-Color",
  WUBRG: "Five-Color",
};

/** "Kirk / Spock" style commander field and a decklist with the commanders first. */
export function decklistOf(deck) {
  const commanders = (deck.commander || []).filter((c) => c?.name);
  const cards = [...commanders, ...(deck.mainBoard || [])].filter((c) => c?.name && c.count > 0);
  return {
    commander: commanders.map((c) => c.name).join(" / "),
    decklist: cards.map((c) => `${c.count} ${c.name}`).join("\n"),
    total: cards.reduce((sum, c) => sum + c.count, 0),
  };
}

/** The sample already in Try a Deck for an MTGJSON deck (same name, key or commanders), if any. */
export function existingSample(entry, commander, samples) {
  const name = slug(entry.name);
  const year = String(entry.releaseDate || "").slice(0, 4);
  const commanders = slug(commander);
  return samples.find(
    (s) =>
      slug(s.flavorName || "") === name ||
      s.key === `cmd${year}-${name}` ||
      (commanders && slug(s.commander) === commanders),
  );
}

/** A key not used by any sample: cmd<year>-<slug>, with -2, -3... if needed. */
export function uniqueKey(entry, samples) {
  const base = `cmd${String(entry.releaseDate).slice(0, 4)}-${slug(entry.name)}`;
  let key = base;
  for (let n = 2; samples.some((s) => s.key === key); n++) key = `${base}-${n}`;
  return key;
}

/**
 * The import itself, with every input passed in (tests use fixtures; no live calls).
 * @param {{ fetchJson: FetchJson, wait?: (ms: number) => Promise<void>, samples: Sample[],
 *   cards: any[], spellbook: any, winRates: any[], fingerprints: any[], metadata: any[],
 *   today: string, since?: string }} input
 */
export async function findNewPrecons(input) {
  const { fetchJson, samples, cards, today } = input;
  const since = input.since || IMPORT_SINCE;
  const wait = input.wait || sleep;
  const list = await fetchJson(`${MTGJSON}/DeckList.json`);
  const sets = await fetchJson(`${MTGJSON}/SetList.json`);
  if (!Array.isArray(list?.data) || !Array.isArray(sets?.data))
    throw new Error("MTGJSON lists missing or malformed; nothing imported.");
  const setNames = new Map(sets.data.map((s) => [s.code, s.name]));
  const candidates = list.data
    .filter((d) => d.type === "Commander Deck" && d.releaseDate >= since && d.fileName)
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.name.localeCompare(b.name));

  const indexes = buildLookupIndexes(cards);
  const ctx = createEngineContext({
    cards,
    spellbook: buildSpellbookIndex(input.spellbook),
    winRates: input.winRates,
  });
  const known = [...samples];
  const report = { added: [], present: [], waiting: [], skipped: [] };
  for (const entry of candidates) {
    if (existingSample(entry, "", known)) {
      report.present.push({ name: entry.name, key: existingSample(entry, "", known).key });
      continue;
    }
    if (entry.releaseDate > today) {
      report.waiting.push({ name: entry.name, why: `releases ${entry.releaseDate}` });
      continue;
    }
    await wait(1000);
    const file = await fetchJson(`${MTGJSON}/decks/${encodeURIComponent(entry.fileName)}.json`);
    const deck = file?.data;
    if (!deck) {
      report.skipped.push({ name: entry.name, why: "deck file not found" });
      continue;
    }
    const { commander, decklist, total } = decklistOf(deck);
    const already = existingSample(entry, commander, known);
    if (already) {
      report.present.push({ name: entry.name, key: already.key });
      continue;
    }
    if (!commander || total !== 100) {
      report.skipped.push({ name: entry.name, why: `${total} cards, commander "${commander}"` });
      continue;
    }
    const match = matchDecklist(parseDecklist(decklist).entries, cards, indexes);
    if (match.notFound.length) {
      report.waiting.push({
        name: entry.name,
        why: `${match.notFound.length} card(s) not in the card database yet`,
      });
      continue;
    }
    const commanders = parseCommanderField(ctx, commander, match.matched);
    const agg = analyzeDeck(ctx, match.matched, commanders);
    const closest = computeArchetypeMatch(input.fingerprints, input.metadata, agg);
    const archetype = closest?.top.deck.archetype || "Midrange & Goodstuff";
    const identity = ["W", "U", "B", "R", "G"]
      .filter((c) => commanders.some((n) => (cards.find((k) => k.n === n)?.ci || "").includes(c)))
      .join("");
    const setName = setNames.get(entry.code) || entry.code;
    const year = Number(entry.releaseDate.slice(0, 4));
    const sample = {
      key: uniqueKey(entry, known),
      flavorName: entry.name,
      style: `${COLOUR_NAMES[identity] || "Multicolor"} ${archetype}`,
      archetype,
      commander,
      tagline: `A ${year} Commander precon from ${setName}, led by ${commander}.`,
      decklist,
      source: "precon",
      year,
      setName,
      addedAt: today,
    };
    known.push(sample);
    report.added.push({ ...sample, closest: closest?.top.key || null });
  }
  return { samples: known, report };
}

/** The pull-request body: what was added (with labels to review), and what was not, and why. */
export function reportMarkdown(report) {
  const lines = ["## New precons for Try a Deck", ""];
  if (!report.added.length) lines.push("No new Commander precons to add.", "");
  for (const a of report.added) {
    lines.push(
      `- **${a.flavorName}** (${a.setName}) — \`${a.key}\`, commander ${a.commander}.`,
      `  Suggested archetype **${a.archetype}** (closest: \`${a.closest}\`), style "${a.style}".`,
      `  Tagline: "${a.tagline}"`,
    );
  }
  const section = (title, rows) => {
    if (!rows.length) return;
    lines.push("", `### ${title}`, "");
    for (const r of rows)
      lines.push(`- ${r.name}${r.key ? ` = \`${r.key}\`` : ""}${r.why ? `: ${r.why}` : ""}`);
  };
  section("Already in Try a Deck", report.present);
  section("Waiting (picked up on a later run)", report.waiting);
  section("Skipped", report.skipped);
  return lines.join("\n") + "\n";
}

/** The numbered change doc for an import (docs/changes convention; headings checked by tests). */
export function changeDoc(report, number, today) {
  const names = report.added.map((a) => a.flavorName);
  const list = report.added
    .map(
      (a) => `- **${a.flavorName}** (${a.setName}), \`${a.key}\`: ${a.commander}; ${a.archetype}.`,
    )
    .join("\n");
  return `# ${String(number).padStart(3, "0")}: Add ${names.length} new precon${names.length === 1 ? "" : "s"} to Try a Deck

Date: ${today}

## Summary

The weekly precon importer found ${names.length} new official Commander precon${names.length === 1 ? "" : "s"} on MTGJSON with every card
already in the card database, and added ${names.length === 1 ? "it" : "them"} to Try a Deck. Signed-in players see a "New in Try a
Deck" notice for 30 days. The decks also join the Closest Match, staples, mana-base and percentile comparisons,
which can shift those slightly for some decks.

## What users see

${list}

The archetype, style and tagline are the importer's suggestions; edit them in this pull request if they read wrong.

## How it works

- \`pipelines/precons/import-precons.mjs\` appended the decks to \`public/data/TRY_A_DECK_OPTIONS.json\` (with
  \`addedAt: ${today}\`) and refreshed \`TRY_A_DECK_METADATA.json\`.
- \`tests/golden/generate-fixture.mjs --add\` pinned only the new decks' cards; existing pinned cards are unchanged.
- \`pipelines/reference-corpus/benchmark-baselines.mjs --update-public-data --from-fixtures\` rebuilt the
  precon benchmarks and the reference set's sample rows.
- Golden snapshots were added for the new decks only; \`pipelines/precons/snapshot-guard.mjs\` confirmed every
  existing snapshot is byte-identical.
- No Firestore changes.

## Testing

CI runs on this branch (unit, golden, e2e, budget). The importer's own report is below the PR description.

## Risks and rollback

Labels may need editing. Revert with \`git revert <sha>\`; the decks then disappear from Try a Deck and the
comparisons return to their previous values.

## Follow-ups

None.

## Related

035 (reference set builder), 036 (Try-a-Deck notices), 037 (the importer).
`;
}

async function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? undefined : argv[i + 1];
  };
  const cardsPath = arg("--cards");
  const reportPath = arg("--report");
  if (!cardsPath || !reportPath)
    throw new Error("Usage: import-precons.mjs --cards <cards.json> --report <report.md>");
  const dataDir = fileURLToPath(new URL("../../public/data/", import.meta.url));
  const read = (name) => JSON.parse(readFileSync(`${dataDir}${name}.json`, "utf8"));
  const samples = read("TRY_A_DECK_OPTIONS");
  const { samples: next, report } = await findNewPrecons({
    fetchJson: (url) => getJson(url, { userAgent: USER_AGENT }),
    samples,
    cards: await decodeCardDatabase(JSON.parse(readFileSync(cardsPath, "utf8"))),
    spellbook: JSON.parse(
      gunzipSync(Buffer.from(read("SPELLBOOK_SNAPSHOT_B64"), "base64")).toString("utf8"),
    ),
    winRates: read("winrates"),
    fingerprints: read("PRECON_FINGERPRINTS"),
    metadata: read("TRY_A_DECK_METADATA"),
    today: arg("--today") || new Date().toISOString().slice(0, 10),
    since: arg("--since"),
  });
  writeFileSync(reportPath, reportMarkdown(report));
  const docsDir = arg("--change-doc-dir");
  if (report.added.length && docsDir) {
    const numbers = readdirSync(docsDir)
      .map((f) => Number(f.match(/^(\d{3})_/)?.[1]))
      .filter(Number.isFinite);
    const number = Math.max(0, ...numbers) + 1;
    const today = arg("--today") || new Date().toISOString().slice(0, 10);
    writeFileSync(
      `${docsDir}/${String(number).padStart(3, "0")}_change_precons-${today}.md`,
      changeDoc(report, number, today),
    );
  }
  if (report.added.length) {
    writeFileSync(`${dataDir}TRY_A_DECK_OPTIONS.json`, JSON.stringify(next) + "\n");
    writeDeckMetadata(dataDir);
    updateManifest(
      dataDir,
      ["TRY_A_DECK_OPTIONS", "TRY_A_DECK_METADATA"],
      "pipelines/precons/import-precons.mjs",
    );
  }
  console.log(`Added ${report.added.length} precon(s); report in ${reportPath}`);
}

if (isMain(import.meta.url)) await main(process.argv.slice(2));
