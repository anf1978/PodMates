const datasets = new Map<string, Promise<unknown>>();
let completed = 0;

declare global {
  interface Window {
    __dbReady?: boolean;
    __dbWatchdogFired?: boolean;
    __dbLoadPct?: number;
  }
}

function reportProgress(name: string) {
  if (typeof document === "undefined" || window.__dbReady || window.__dbWatchdogFired) return;
  const message = document.getElementById("dbStatus");
  const fill = document.getElementById("dbLoadFill");
  if (message) message.textContent = `Loading ${name}... (${completed}/${datasets.size} datasets)`;
  const percent = Math.max(window.__dbLoadPct ?? 8, 8 + (completed / datasets.size) * 70);
  window.__dbLoadPct = percent;
  if (fill) {
    fill.classList.remove("indeterminate");
    fill.style.width = `${percent}%`;
  }
}

// Spellbook stays a gzip/base64 JSON string; the legacy decoder still owns decompression.
export function loadDataset<T>(name: string): Promise<T> {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error(`Invalid dataset name: ${name}`);
  let promise = datasets.get(name);
  if (!promise) {
    promise = (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`, {
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
