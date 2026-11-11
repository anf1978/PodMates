import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { appendFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getJson, sleep } from "./http.mjs";
import { isMain } from "./cli.mjs";

const USER_AGENT = "PodMatesPriceScry/1.0 (+https://github.com/anf1978/PodMates)";

/** @param {number} attempt @param {Response} response */
function retryDelay(attempt, response) {
  const retryAfter = response.headers.get("retry-after");
  const seconds = Number(retryAfter);
  const delay =
    retryAfter && !Number.isNaN(seconds)
      ? seconds * 1000
      : retryAfter
        ? Date.parse(retryAfter) - Date.now()
        : 0;
  if (delay > 60_000) throw new Error("Scryfall Retry-After exceeds the 60-second retry budget");
  return Math.max(1500 * attempt, Number.isFinite(delay) ? delay : 0);
}

/** @param {string} type */
export async function resolveBulk(type) {
  if (!["oracle_cards", "default_cards"].includes(type)) {
    throw new Error(`Unsupported Scryfall bulk type: ${type}`);
  }
  const metadata = await getJson(`https://api.scryfall.com/bulk-data/${type}`, {
    userAgent: USER_AGENT,
    retryDelay,
  });
  const uri = metadata?.jsonl_download_uri || metadata?.download_uri;
  if (metadata?.type !== type || typeof uri !== "string" || !metadata.updated_at) {
    throw new Error(`Invalid Scryfall bulk metadata for ${type}`);
  }
  const url = new URL(uri);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "data.scryfall.io" ||
    url.username ||
    url.password
  ) {
    throw new Error("Unexpected Scryfall bulk download origin");
  }
  const key = createHash("sha256")
    .update(JSON.stringify([type, metadata.updated_at, uri]))
    .digest("hex");
  return { uri: url.href, key, path: `.cache/scryfall/${key}/bulk.jsonl` };
}

/**
 * Fetch decodes HTTP Content-Encoding; file-level gzip is preserved for the existing
 * magic-byte readers. Streaming keeps the every-printing export out of the JS heap.
 * @param {string} uri @param {string} destination
 */
export async function downloadBulk(uri, destination) {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.part`;
  try {
    await sleep(120);
    for (let attempt = 1; attempt <= 4; attempt++) {
      let response;
      try {
        response = await fetch(uri, {
          headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
          signal: AbortSignal.timeout(15 * 60_000),
        });
      } catch (error) {
        if (!(error instanceof TypeError) || attempt === 4) throw error;
        console.warn(`Scryfall bulk network failure; retrying (attempt ${attempt})`);
        await sleep(1500 * attempt);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        if ((response.status === 429 || response.status >= 500) && attempt < 4) {
          const delay = retryDelay(attempt, response);
          console.warn(`Scryfall bulk HTTP ${response.status}; retrying in ${delay}ms`);
          await sleep(delay);
          continue;
        }
        throw new Error(`Scryfall bulk HTTP ${response.status} (attempt ${attempt})`);
      }
      if (!response.body) throw new Error("Empty Scryfall bulk response");
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
      if (!(await stat(temporary)).size) throw new Error("Empty Scryfall bulk file");
      await rename(temporary, destination);
      return;
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

if (isMain(import.meta.url)) {
  const [command, value, destination] = process.argv.slice(2);
  if (command === "metadata") {
    const metadata = await resolveBulk(value);
    if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
    await appendFile(
      process.env.GITHUB_OUTPUT,
      Object.entries(metadata)
        .map(([key, entry]) => `${key}=${entry}\n`)
        .join(""),
    );
  } else if (command === "download" && value && destination) {
    await downloadBulk(value, destination);
  } else {
    throw new Error("Usage: scryfall-bulk.mjs metadata <type> | download <uri> <path>");
  }
}
