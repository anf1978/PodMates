// Fetches the tuned and cEDH decklists of the reference set into committed files, so they can never be
// lost again (the October lists were; their rows stayed frozen until change 055).
//
// The manifest, reference-decks.json, is both the spec and the record. Each deck names its tier, key,
// commander, archetype and where it comes from; this script fills in what it fetched (source URL, event,
// fetch date, card count, primer links) and writes the list to decks/<tier>/<key>.txt in "1 Card Name"
// form, commanders first.
//
// - Tuned ("t"): EDHREC "optimized" (Bracket 4) average decks, json.edhrec.com/pages/average-decks/<slug>/optimized.json.
// - cEDH ("c"): one tournament list per commander from EDHTop16. The chosen entry is the best finish on the
//   commander's page (its default: the last year, events of 50+ players): lowest standing, then the larger
//   event, then the more recent one. Player names are not stored; the decklist URL identifies the entry.
// - Primers: cEDH Decklist Database entries for the same commander(s) with a primer (its public GitHub data).
//   Only links and titles are stored: primers are their authors' writing, and Moxfield, where most live,
//   does not allow automated fetching.
//
// Usage: NODE_USE_ENV_PROXY=1 node pipelines/reference-corpus/fetch-reference-decks.mjs [--only <key>] [--refresh]
// Without --refresh a deck that already has a list file is left alone (its pinned list is the record).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { sleep } from "../lib/http.mjs";
import { isMain } from "../lib/cli.mjs";

const USER_AGENT = "PodMates-reference-corpus/1.0 (https://github.com/anf1978/PodMates)";
const DELAY_MS = 2000;
const MANIFEST = new URL("./reference-decks.json", import.meta.url);
const DDB_URL =
  "https://raw.githubusercontent.com/cEDH-Decklist-Database/cEDH-Decklist-Database/master/_data/database.json";

/** @param {string} url */
async function getText(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.ok) return response.text();
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    await sleep(3000 * attempt);
  }
  throw new Error(`Gave up: ${url}`);
}

/** Names compared loosely: case, punctuation and the front face only.
 * @param {string} name */
export function looseName(name) {
  return name
    .split(" // ")[0]
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Kraum, Ludevic's Opus / Tymna the Weaver" → its commanders' loose names, sorted.
 * @param {string} commander */
export function commanderKey(commander) {
  return commander
    .split(/\s+\/\s+(?!\/)/)
    .map(looseName)
    .sort()
    .join(" + ");
}

/** @param {{ commanders: string[], cards: [string, number][] }} deck */
export function toDecklist({ commanders, cards }) {
  const lines = commanders.map((name) => `1 ${name}`);
  for (const [name, count] of cards) lines.push(`${count} ${name}`);
  return lines.join("\n") + "\n";
}

/** @param {string} text */
export function countCards(text) {
  return text
    .split("\n")
    .filter(Boolean)
    .reduce((sum, line) => sum + Number(line.split(" ", 1)[0]), 0);
}

/** EDHREC average deck JSON → commanders and cards.
 * @param {any} json */
export function parseEdhrecAverage(json) {
  const deck = json?.deck;
  if (!deck?.commander || !deck?.cards) throw new Error("No deck in the EDHREC response");
  const commanders = [...deck.commander];
  /** @type {[string, number][]} */
  const cards = [];
  for (const group of Object.values(deck.cards)) {
    for (const [name, count] of /** @type {[string, number][]} */ (group))
      cards.push([name, count]);
  }
  cards.sort((a, b) => a[0].localeCompare(b[0]));
  return { commanders, cards, header: String(json.header || "") };
}

/** Unescapes the JSON string fragments EDHTop16 embeds in its pages.
 * @param {string} s */
function unescapeJson(s) {
  return JSON.parse(`"${s}"`);
}

/** The entries embedded in an EDHTop16 commander page.
 * @param {string} html */
export function parseEdhtop16Entries(html) {
  const re =
    /"standing":(\d+),"wins":(\d+),"losses":(\d+),"draws":(\d+),"decklist":"((?:[^"\\]|\\.)*)","decklistUrl":"((?:[^"\\]|\\.)*)"[\s\S]*?"tournament":\{"name":"((?:[^"\\]|\\.)*)","size":(\d+),"tournamentDate":"([^"]+)","TID":"([^"]+)"/g;
  const seen = new Set();
  const entries = [];
  for (const m of html.matchAll(re)) {
    const decklistUrl = unescapeJson(m[6]);
    if (seen.has(decklistUrl)) continue;
    seen.add(decklistUrl);
    entries.push({
      standing: Number(m[1]),
      record: `${m[2]}-${m[3]}-${m[4]}`,
      originalList: unescapeJson(m[5]),
      decklistUrl,
      event: unescapeJson(m[7]).trim(),
      size: Number(m[8]),
      date: m[9].slice(0, 10),
    });
  }
  return entries;
}

/** Best finish first: lowest standing, then the larger event, then the more recent.
 * @param {ReturnType<typeof parseEdhtop16Entries>} entries */
export function pickBestEntry(entries) {
  const usable = entries.filter((e) => e.decklistUrl && e.size >= 50);
  usable.sort((a, b) => a.standing - b.standing || b.size - a.size || b.date.localeCompare(a.date));
  return usable[0] || null;
}

/** The main-deck cards of an EDHTop16 decklist page (commanders are listed separately).
 * @param {string} html */
export function parseEdhtop16Decklist(html) {
  /** @type {Map<string, number>} */
  const cards = new Map();
  const re = /\{"count":(\d+),"spice":[^{}]*?"card":\{"id":"[^"]*","name":"((?:[^"\\]|\\.)*)"/g;
  for (const m of html.matchAll(re)) {
    const name = unescapeJson(m[2]);
    if (!cards.has(name)) cards.set(name, Number(m[1]));
  }
  return [...cards.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** cEDH Decklist Database primers for a commander pairing.
 * @param {any[]} ddb @param {string} commander */
export function primersFor(ddb, commander) {
  const want = commanderKey(commander);
  const out = [];
  for (const deck of ddb) {
    const names = (deck.commander || []).map((/** @type {any} */ c) => c.name).join(" / ");
    if (commanderKey(names) !== want) continue;
    for (const list of deck.decklists || []) {
      if (!list.primer || !list.link) continue;
      out.push({
        title: String(list.title || deck.title || "").trim(),
        url: list.link,
        database: `${deck.title} (${deck.section})`,
        updated: String(deck.updated || "").slice(0, 10),
      });
    }
  }
  return out;
}

/** @param {any} deck @param {any[] | null} ddb @param {string} today */
async function fetchDeck(deck, ddb, today) {
  if (deck.tier === "t") {
    const url = `https://json.edhrec.com/pages/average-decks/${deck.edhrecSlug}/optimized.json`;
    const parsed = parseEdhrecAverage(JSON.parse(await getText(url)));
    if (!/optimized/i.test(parsed.header))
      throw new Error(`${deck.key}: unexpected page ${parsed.header}`);
    deck.commander = parsed.commanders.join(" / ");
    deck.source = {
      kind: "edhrec-average-optimized",
      url: `https://edhrec.com/average-decks/${deck.edhrecSlug}/optimized`,
      fetched: today,
    };
    deck.primers = [];
    deck.primerNote =
      "EDHREC average decks are statistical averages of many lists; they have no primer.";
    return toDecklist(parsed);
  }
  const page = await getText(
    `https://edhtop16.com/commander/${encodeURIComponent(deck.commander)}`,
  );
  const best = pickBestEntry(parseEdhtop16Entries(page));
  if (!best) throw new Error(`${deck.key}: no EDHTop16 entry with a decklist`);
  await sleep(DELAY_MS);
  const cards = parseEdhtop16Decklist(await getText(`https://edhtop16.com${best.decklistUrl}`));
  const commanders = deck.commander.split(/\s+\/\s+(?!\/)/);
  deck.source = {
    kind: "edhtop16-tournament",
    url: `https://edhtop16.com${best.decklistUrl}`,
    originalList: best.originalList,
    event: best.event,
    players: best.size,
    standing: best.standing,
    record: best.record,
    date: best.date,
    fetched: today,
  };
  deck.primers = ddb ? primersFor(ddb, deck.commander) : [];
  if (!deck.primers.length) {
    deck.primerNote = "No primer listed for this commander in the cEDH Decklist Database.";
  } else delete deck.primerNote;
  return toDecklist({ commanders, cards });
}

/** @param {string[]} argv */
async function main(argv) {
  const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
  const refresh = argv.includes("--refresh");
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const today = new Date().toISOString().slice(0, 10);
  const ddb = JSON.parse(await getText(DDB_URL));
  const failures = [];
  for (const deck of manifest.decks) {
    if (only && deck.key !== only) continue;
    const dir = new URL(`./decks/${deck.tier === "t" ? "tuned" : "cedh"}/`, import.meta.url);
    const file = new URL(`${deck.key}.txt`, dir);
    if (existsSync(file) && !refresh) continue;
    try {
      const text = await fetchDeck(deck, ddb, today);
      deck.cardCount = countCards(text);
      if (deck.cardCount !== 100) throw new Error(`${deck.cardCount} cards, expected 100`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, text);
      console.log(`${deck.key}: ${deck.cardCount} cards, ${deck.primers.length} primer link(s)`);
    } catch (error) {
      failures.push(deck.key);
      console.error(`${deck.key}: ${/** @type {Error} */ (error).message}`);
    }
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
    await sleep(DELAY_MS);
  }
  if (failures.length) {
    console.error(`Failed: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

if (isMain(import.meta.url)) await main(process.argv.slice(2));
