// @ts-check

/** @typedef {[string, string, string, string, string, number, string, string, string?, number?, string?, string?, number?, string?, string?, string?]} CardTuple */
/** @typedef {{cards: CardTuple[], gc: string[], banned: string[]}} CardPayload */
/** @typedef {(message: string, percent: number) => void} Progress */

/**
 * @param {CardPayload} payload
 * @param {Progress} [report]
 */
export function decodeCardRecords(payload, report = () => {}) {
  const gcSet = new Set(payload.gc);
  const bannedSet = new Set(payload.banned);
  return payload.cards.map((t, i) => {
    if (i % 1024 === 0) report("Building card records...", 70 + (i / payload.cards.length) * 15);
    return {
      n: t[0],
      t: t[1],
      o: t[2],
      c: t[3],
      ci: t[4],
      m: t[5],
      p: t[6],
      r: t[7],
      // Missing optional fields must stay undefined for older publications.
      pm: t.length > 8 ? t[8] || "" : undefined,
      rt: t.length > 9 ? t[9] === 1 : undefined,
      pw: t.length > 10 ? t[10] : undefined,
      tg: t.length > 11 ? t[11] : undefined,
      x: t.length > 12 ? t[12] === 1 : undefined,
      ly: t.length > 13 ? t[13] : undefined,
      ob: t.length > 14 ? t[14] : undefined,
      bt: t.length > 15 ? t[15] : undefined,
      g: gcSet.has(t[0]),
      b: bannedSet.has(t[0]),
    };
  });
}

/**
 * @param {ReturnType<typeof decodeCardRecords>} db
 * @param {Progress} [report]
 */
export function buildLookupIndexes(db, report = () => {}) {
  /** @type {Map<string, (typeof db)[number]>} */
  const byExactName = new Map();
  /** @type {Map<string, (typeof db)[number]>} */
  const byFrontFaceName = new Map();
  /** @type {Map<string, (typeof db)[number]>} */
  const byBackFaceName = new Map();
  for (const [i, card] of db.entries()) {
    if (i % 1024 === 0) report("Building lookup indexes...", 85 + (i / db.length) * 10);
    byExactName.set(card.n.toLowerCase(), card);
    if (card.n.includes(" // ")) {
      const [frontRaw, backRaw] = card.n.split(" // ");
      const front = frontRaw.trim().toLowerCase();
      const back = (backRaw || "").trim().toLowerCase();
      if (!byFrontFaceName.has(front)) byFrontFaceName.set(front, card);
      if (back && !byBackFaceName.has(back)) byBackFaceName.set(back, card);
    }
  }
  return { byExactName, byFrontFaceName, byBackFaceName };
}

/**
 * @param {string} compressed
 * @param {Progress} [report]
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
