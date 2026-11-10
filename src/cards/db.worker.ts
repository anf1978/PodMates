import { buildLookupIndexes, decodeCardDatabase } from "./db-codec.js";

export type Card = Awaited<ReturnType<typeof decodeCardDatabase>>[number];
type IndexEntries = [string, Card][];
export type WorkerMessage =
  | { type: "progress"; message: string; percent: number }
  | { type: "unsupported" }
  | { type: "error"; message: string }
  | {
      type: "ready";
      cards: Card[];
      compressed: string;
      indexes: {
        byExactName: IndexEntries;
        byFrontFaceName: IndexEntries;
        byBackFaceName: IndexEntries;
      };
    };

const post = (message: WorkerMessage) => self.postMessage(message);

self.onmessage = async ({ data }: MessageEvent<{ url: string }>) => {
  if (typeof DecompressionStream === "undefined") {
    post({ type: "unsupported" });
    return;
  }
  const report = (message: string, percent: number) => post({ type: "progress", message, percent });
  try {
    report("Fetching card database...", 8);
    const response = await fetch(data.url);
    if (!response.ok) throw new Error(`Could not load dataset cards: HTTP ${response.status}`);
    if (!response.body) throw new Error("Card database response has no body");
    const reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    const length = Number(response.headers.get("content-length"));
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      report(
        `Fetching card database... (${received.toLocaleString()} bytes)`,
        length > 0 ? 8 + Math.min(1, received / length) * 17 : 8,
      );
    }
    const compressed: unknown = JSON.parse(await new Blob(chunks).text());
    if (typeof compressed !== "string")
      throw new Error("Card database must be a gzip/base64 string");
    const cards = await decodeCardDatabase(compressed, report);
    const indexes = buildLookupIndexes(cards, report);
    report("Transferring card database...", 95);
    post({
      type: "ready",
      cards,
      compressed,
      indexes: {
        byExactName: [...indexes.byExactName],
        byFrontFaceName: [...indexes.byFrontFaceName],
        byBackFaceName: [...indexes.byBackFaceName],
      },
    });
  } catch (error) {
    post({
      type: "error",
      message: `Card database worker failed: ${error instanceof Error ? error.message || error.name : String(error)}`,
    });
  }
};
