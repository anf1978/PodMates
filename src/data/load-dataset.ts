import { prepareOffline } from "../services/pwa";

const datasets = new Map<string, Promise<unknown>>();
let completed = 0;
let manifestPromise: Promise<DatasetManifest> | undefined;

export interface DatasetMetadata {
  version: string;
  generatedAt: string;
  sha256: string;
  bytes: number;
  source: string;
}

export interface DatasetManifest {
  files: Record<string, DatasetMetadata>;
}

export function loadManifest(): Promise<DatasetManifest> {
  return (manifestPromise ??= (async () => {
    try {
      await prepareOffline();
      const response = await fetch(`${import.meta.env.BASE_URL}data/manifest.json`, {
        cache: "no-cache",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest: DatasetManifest = await response.json();
      if (
        !manifest ||
        !manifest.files ||
        typeof manifest.files !== "object" ||
        Array.isArray(manifest.files)
      ) {
        throw new Error("Missing dataset entries");
      }
      for (const [name, entry] of Object.entries(manifest.files)) {
        if (
          !/^[A-Za-z0-9_-]+\.json$/.test(name) ||
          !entry ||
          typeof entry.version !== "string" ||
          !entry.version ||
          typeof entry.generatedAt !== "string" ||
          !/^\d{4}-\d\d-\d\dT/.test(entry.generatedAt) ||
          !Number.isFinite(Date.parse(entry.generatedAt)) ||
          typeof entry.sha256 !== "string" ||
          !/^[a-f0-9]{64}$/.test(entry.sha256) ||
          !Number.isSafeInteger(entry.bytes) ||
          entry.bytes < 0 ||
          typeof entry.source !== "string" ||
          !entry.source
        ) {
          throw new Error(`Invalid metadata for ${name}`);
        }
      }
      return manifest;
    } catch (error) {
      throw new Error(
        `Could not load dataset manifest: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  })());
}

export async function datasetUrl(name: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error(`Invalid dataset name: ${name}`);
  const manifest = await loadManifest();
  const entry = manifest.files[`${name}.json`];
  if (!entry) throw new Error(`Dataset missing from manifest: ${name}`);
  return `${import.meta.env.BASE_URL}data/${name}.json?v=${entry.sha256}`;
}

export async function updateDataFreshness(): Promise<void> {
  const manifest = await loadManifest();
  const cards = manifest.files["cards.json"];
  const winrates = manifest.files["winrates.json"];
  if (!cards || !winrates) throw new Error("Missing card or win-rate freshness metadata");
  const stale = Date.now() - Date.parse(cards.generatedAt) > 14 * 86_400_000;
  const text =
    `Card data as of ${cards.generatedAt.slice(0, 10)} \u00b7 ` +
    `Win-rates as of ${winrates.generatedAt.slice(0, 10)}` +
    (stale ? " \u00b7 Card data is over 14 days old" : "");
  const footer = document.getElementById("dataFreshness");
  if (footer) footer.textContent = text;
  if (stale) console.warn(`PodMates: card data is over 14 days old (${cards.generatedAt}).`);
}

type DatasetProgress = (name: string, completed: number, total: number) => void;
let progressListener: DatasetProgress | undefined;

/** The boot bar listens here: called when a dataset fetch starts and when it finishes. */
export function onDatasetProgress(listener: DatasetProgress): void {
  progressListener = listener;
}

function reportProgress(name: string) {
  progressListener?.(name, completed, datasets.size);
}

// Spellbook stays a gzip/base64 JSON string; services/card-db-boot owns decompression.
export function loadDataset<T>(name: string): Promise<T> {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error(`Invalid dataset name: ${name}`);
  let promise = datasets.get(name);
  if (!promise) {
    promise = (async () => {
      try {
        const response = await fetch(await datasetUrl(name), {
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const value: unknown = await response.json();
        completed++;
        reportProgress(name);
        return value;
      } catch (error) {
        throw new Error(
          `Could not load dataset ${name}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    })();
    datasets.set(name, promise);
    reportProgress(name);
  }
  return promise as Promise<T>;
}
