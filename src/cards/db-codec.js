// @ts-check
// Decodes the published gzip/base64 card database into card records, on the worker
// thread or (as a fallback) the main thread. Shared with the golden harness, so it
// must stay DOM-free; tuple positions are read only through src/cards/tuple.ts.

import { cardFromTuple, cardName } from "./tuple.ts";

/** @typedef {import("./tuple.ts").CardTuple} CardTuple */
/** @typedef {import("./tuple.ts").CardRecord} CardRecord */
/** @typedef {{cards: CardTuple[], gc: string[], banned: string[]}} CardPayload */
/** @typedef {(message: string, percent: number) => void} Progress */

/**
 * @param {CardPayload} payload
 * @param {Progress} [report]
 * @returns {CardRecord[]}
 */
export function decodeCardRecords(payload, report = () => {}) {
  const gcSet = new Set(payload.gc);
  const bannedSet = new Set(payload.banned);
  return payload.cards.map((tuple, i) => {
    if (i % 1024 === 0) report("Building card records...", 70 + (i / payload.cards.length) * 15);
    return cardFromTuple(tuple, {
      gameChanger: gcSet.has(cardName(tuple)),
      banned: bannedSet.has(cardName(tuple)),
    });
  });
}

/**
 * @param {string} compressed
 * @param {Progress} [report]
 * @returns {Promise<CardRecord[]>}
 */
export async function decodeCardDatabase(compressed, report = () => {}) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "This browser doesn't support DecompressionStream, which the card database requires. Try updating your browser, or use a recent Chrome or Safari.",
    );
  }
  report("Decoding compressed data...", 25);
  const binary = atob(compressed);
  const bytes = new Uint8Array(binary.length);
  const chunkSize = 65536;
  for (let start = 0; start < binary.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, binary.length);
    for (let i = start; i < end; i++) bytes[i] = binary.charCodeAt(i);
    report("Decoding compressed data...", 25 + (end / binary.length) * 10);
    if (end < binary.length) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  report("Decompressing card data...", 35);
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  // Drain concurrently with write/close to avoid transform-stream backpressure deadlock.
  const writing = writer.write(bytes).then(() => writer.close());
  const reading = (async () => {
    const reader = stream.readable.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
      report("Decompressing card data...", 35 + Math.min(25, total / 1_000_000));
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  })();
  const [merged] = await Promise.all([reading, writing]).catch((error) => {
    throw new Error(
      `Could not decompress card database: ${error instanceof Error ? error.message || error.name : String(error)}`,
      { cause: error },
    );
  });
  report("Parsing card data...", 65);
  /** @type {CardPayload} */
  const payload = JSON.parse(new TextDecoder().decode(merged));
  const cards = decodeCardRecords(payload, report);
  if (!cards.length) throw new Error("CARD_DB missing or empty after decompression");
  return cards;
}
