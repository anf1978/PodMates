// PodMates commander win-rate database builder. Playgroup.gg's public API
// only offers a per-ID lookup (GET /commanders/{id}), not a bulk/list
// endpoint -- confirmed directly by checking their Swagger docs. Playgroup
// have explicitly said bulk access via ID scanning is fine, as long as
// requests identify themselves with a descriptive User-Agent, which this
// respects along with their stated 400 requests/minute limit.
//
// Usage: node build-winrate-db.mjs [output-file]

import { writeFileSync } from "fs";
import { getJson, sleep } from "../lib/http.mjs";
import { isMain } from "../lib/cli.mjs";

const API_BASE = "https://playgroup.gg/api/public/v1";
const USER_AGENT =
  "PodMates/1.0 (+https://github.com/anf1978/PodMates; MTG Commander deck analysis tool)";
// Comfortably under the stated 400/minute limit rather than pushing right
// up against it -- this is a weekly background job with no reason to be
// aggressive about it.
const REQUESTS_PER_MINUTE = 250;
const DELAY_MS = Math.ceil(60000 / REQUESTS_PER_MINUTE);
// A long enough streak of consecutive misses to be confident we've passed
// the highest assigned ID, generous enough to tolerate ordinary gaps
// (deleted entries, IDs never assigned) without stopping early.
const CONSECUTIVE_MISS_LIMIT = 300;
// Matches the threshold already documented in the app's own footer text
// ("at least 250 tracked games and 10 distinct pilots") -- kept identical
// rather than invented fresh. The API doesn't expose a distinct-pilot
// count directly, only decks_count, which is used here as the closest
// available proxy -- not a perfect match (one player can own several
// decks for the same commander), but close enough to keep the filter
// faithful to what's already documented rather than silently dropping
// half of it.
const MIN_GAMES = 250;
const MIN_DECKS = 10;
// A real Commander Track Record dataset has been in the ~1,200-1,400 range.
// Anything wildly outside that suggests something went wrong upstream
// (a malformed response, a change in the API, a network issue truncating
// the scan) rather than a trustworthy result -- refusing to write output
// in that case is what stops a bad run from silently overwriting a
// working dataset, the same lesson the card database incident taught.
const MIN_PLAUSIBLE_COUNT = 500;
const MAX_PLAUSIBLE_COUNT = 5000;

function tierFor(winRate) {
  if (winRate >= 35) return "S";
  if (winRate >= 30) return "A";
  if (winRate >= 23) return "B";
  if (winRate >= 18) return "C";
  return "D";
}

async function fetchCommander(id) {
  return getJson(`${API_BASE}/commanders/${id}`, {
    userAgent: USER_AGENT,
    retryDelay: (_attempt, response) => {
      const seconds = Number(response.headers.get("Retry-After") || 5);
      return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 5000;
    },
  });
}

/**
 * @typedef {{name: string, global_rank: number, stats?: {games_count?: number, decks_count?: number, win_rate?: number}}} Commander
 */

/** @param {Commander} card */
export function commanderRow(card) {
  const stats = card.stats || {};
  if ((stats.games_count || 0) < MIN_GAMES || (stats.decks_count || 0) < MIN_DECKS) return null;
  if (
    !card.name ||
    !Number.isFinite(stats.win_rate) ||
    stats.win_rate < 0 ||
    stats.win_rate > 100 ||
    !Number.isInteger(stats.games_count) ||
    !Number.isInteger(card.global_rank) ||
    card.global_rank < 1
  ) {
    throw new Error("Malformed qualifying commander response");
  }
  return {
    n: card.name,
    t: tierFor(stats.win_rate),
    w: stats.win_rate,
    g: stats.games_count,
    r: card.global_rank,
  };
}

/**
 * @param {string} outPath
 * @param {{fetchCommander?: (id: number) => Promise<Commander | null>, sleep?: (ms: number) => Promise<unknown>}} dependencies
 */
export async function build(outPath, dependencies = {}) {
  const fetchNext = dependencies.fetchCommander || fetchCommander;
  const pause = dependencies.sleep || sleep;
  const results = [];
  let consecutiveMisses = 0;
  let id = 1;
  let checked = 0;

  while (consecutiveMisses < CONSECUTIVE_MISS_LIMIT) {
    const card = await fetchNext(id);
    checked++;
    if (!card) {
      consecutiveMisses++;
    } else {
      consecutiveMisses = 0;
      const row = commanderRow(card);
      if (row) results.push(row);
    }
    id++;
    await pause(DELAY_MS);
    if (checked % 200 === 0)
      console.log(
        `Checked ${checked} ids (up to ${id - 1}), ${results.length} qualifying so far...`,
      );
  }

  console.log(
    `Stopped after ${CONSECUTIVE_MISS_LIMIT} consecutive misses, highest id checked: ${id - 1}`,
  );

  if (results.length < MIN_PLAUSIBLE_COUNT || results.length > MAX_PLAUSIBLE_COUNT) {
    throw new Error(
      `Got ${results.length} qualifying commanders, expected between ${MIN_PLAUSIBLE_COUNT} and ${MAX_PLAUSIBLE_COUNT}. ` +
        `Refusing to write output -- something is wrong with the scan rather than trusting this result.`,
    );
  }

  results.sort((a, b) => a.r - b.r); // by global rank, matching how this data is presented elsewhere in the app
  const json = JSON.stringify(results);
  writeFileSync(outPath, `${json}\n`, "utf8");
  return { count: results.length, highestIdChecked: id - 1 };
}

if (isMain(import.meta.url)) {
  const [, , outPath] = process.argv;
  try {
    const stats = await build(outPath || "winrates.json");
    console.log("Build complete:", stats);
  } catch (err) {
    console.error("Build failed:", err.message);
    process.exit(1);
  }
}
