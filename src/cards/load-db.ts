import { datasetUrl, loadDataset } from "../data/load-dataset";
import { reportError } from "../services/report-error";
import { decodeCardDatabase } from "./db-codec.js";
import { buildLookupIndexes } from "./lookup.ts";
import type { Card, WorkerMessage } from "./db.worker";

export { buildLookupIndexes };

type Progress = (message: string, percent: number) => void;
type Database = {
  cards: Card[];
  compressed: string;
  indexes: ReturnType<typeof buildLookupIndexes>;
};

export function loadCardDatabase(report: Progress): Promise<Database> {
  let worker: Worker | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let settled = false;
  return new Promise<Database>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      worker?.terminate();
      worker = undefined;
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reportError(error, { operation: "card-database" });
      reject(error);
    };
    const progress: Progress = (message, percent) => {
      if (settled) return;
      clearTimeout(timer);
      timer = setTimeout(
        () => fail(new Error("Card database progress stalled for 30 seconds")),
        30_000,
      );
      report(message, percent);
    };
    const fallback = async () => {
      try {
        progress("Loading card database on the main thread...", 8);
        const compressed = await loadDataset<string>("cards");
        if (settled) return;
        const cards = await decodeCardDatabase(compressed, progress);
        if (settled) return;
        const indexes = buildLookupIndexes(cards, progress);
        settled = true;
        cleanup();
        resolve({ cards, compressed, indexes });
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    };
    if (
      typeof Worker === "undefined" ||
      typeof DecompressionStream === "undefined" ||
      navigator.onLine === false
    ) {
      void fallback();
      return;
    }
    try {
      progress("Starting card database worker...", 8);
      worker = new Worker(new URL("./db.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
        if (settled) return;
        if (data.type === "progress") {
          progress(data.message, data.percent);
        } else if (data.type === "unsupported") {
          cleanup();
          void fallback();
        } else if (data.type === "error") {
          fail(new Error(data.message));
        } else if (data.type === "ready") {
          performance.mark("pm-card-index-hydration-start");
          const indexes = {
            byExactName: new Map(data.indexes.byExactName),
            byFrontFaceName: new Map(data.indexes.byFrontFaceName),
            byBackFaceName: new Map(data.indexes.byBackFaceName),
          };
          performance.measure("pm-card-index-hydration", "pm-card-index-hydration-start");
          settled = true;
          cleanup();
          resolve({ cards: data.cards, compressed: data.compressed, indexes });
        }
      };
      worker.onerror = (event) => fail(new Error(`Card database worker failed: ${event.message}`));
      worker.onmessageerror = () =>
        fail(new Error("Could not receive the card database worker result"));
      void datasetUrl("cards")
        .then((url) => {
          if (!settled) worker?.postMessage({ url: new URL(url, document.baseURI).href });
        })
        .catch((error: unknown) => fail(error instanceof Error ? error : new Error(String(error))));
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
