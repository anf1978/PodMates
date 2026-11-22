// Saves an editor's value a moment after the last change, one write at a time, the latest value winning.
// `flush()` saves anything still waiting (on close) and resolves once every write has finished.

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface Autosaver<T> {
  /** Saves `value` after `delay` ms unless another change comes first. */
  schedule(value: T, delay: number): void;
  /** Saves now whatever is waiting; resolves when nothing is left to save (or a save failed). */
  flush(): Promise<void>;
  /** Drops a waiting save (for example before deleting). */
  cancel(): void;
  status(): SaveStatus;
}

export function createAutosaver<T>(
  write: (value: T) => Promise<void>,
  onStatus: (status: SaveStatus, error: unknown) => void,
): Autosaver<T> {
  let waiting: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | null = null;
  let state: SaveStatus = "idle";
  const set = (next: SaveStatus, error: unknown = null) => {
    state = next;
    onStatus(next, error);
  };

  async function run(): Promise<void> {
    while (waiting) {
      const { value } = waiting;
      waiting = null;
      set("saving");
      try {
        await write(value);
      } catch (error) {
        set("error", error);
        return;
      }
    }
    set("saved");
  }

  function start(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    if (!running)
      running = run().finally(() => {
        running = null;
      });
    return running;
  }

  return {
    schedule(value, delay) {
      waiting = { value };
      if (state !== "saving") set("saving");
      clearTimeout(timer);
      timer = setTimeout(() => void start(), delay);
    },
    async flush() {
      if (running) await running;
      if (waiting) await start();
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
      waiting = null;
    },
    status: () => state,
  };
}
