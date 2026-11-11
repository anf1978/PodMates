import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { WorkerMessage } from "./db.worker";

const hash = "a".repeat(64);
function mockDatasetFetch(body: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith("manifest.json")
        ? Response.json({
            files: {
              "cards.json": {
                version: "test",
                generatedAt: "2026-11-10T00:00:00Z",
                sha256: hash,
                bytes: body.length,
                source: "Test pipeline",
              },
            },
          })
        : new Response(body),
    ),
  );
}

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage!: (event: { data: WorkerMessage }) => void;
  onerror!: (event: { message: string }) => void;
  onmessageerror!: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    TestWorker.instances.push(this);
  }
}

beforeEach(() => {
  TestWorker.instances = [];
  vi.stubGlobal("Worker", TestWorker);
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", {
    baseURI: "https://example.test/PodMates/",
    getElementById: () => null,
  });
  vi.stubEnv("BASE_URL", "/PodMates/");
  mockDatasetFetch('"H4sI"');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("extends the stall deadline on progress and hydrates indexes without duplicating cards", async () => {
  vi.useFakeTimers();
  const { loadCardDatabase } = await import("./load-db");
  const report = vi.fn();
  const promise = loadCardDatabase(report);
  const worker = TestWorker.instances[0];
  await vi.advanceTimersByTimeAsync(0);
  expect(worker.postMessage).toHaveBeenCalledWith({
    url: `https://example.test/PodMates/data/cards.json?v=${hash}`,
  });
  await vi.advanceTimersByTimeAsync(25_000);
  worker.onmessage({ data: { type: "progress", message: "Parsing", percent: 65 } });
  await vi.advanceTimersByTimeAsync(25_000);
  const { decodeCardRecords } = await import("./db-codec.js");
  const cards = decodeCardRecords({
    gc: [],
    banned: [],
    cards: [["Example", "", "", "", "", 0, "", ""]],
  });
  worker.onmessage({
    data: {
      type: "ready",
      cards,
      compressed: "preserved",
      indexes: { byExactName: [["example", cards[0]]], byFrontFaceName: [], byBackFaceName: [] },
    },
  });
  const result = await promise;
  expect(result.indexes.byExactName.get("example")).toBe(result.cards[0]);
  expect(result.compressed).toBe("preserved");
  expect(report).toHaveBeenCalledWith("Parsing", 65);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("terminates a stalled worker and ignores late progress", async () => {
  vi.useFakeTimers();
  const { loadCardDatabase } = await import("./load-db");
  const promise = loadCardDatabase(vi.fn());
  const rejected = expect(promise).rejects.toThrow("progress stalled");
  await vi.advanceTimersByTimeAsync(30_000);
  await rejected;
  const worker = TestWorker.instances[0];
  worker.onmessage({ data: { type: "progress", message: "Too late", percent: 90 } });
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["error", "onerror", "onmessageerror"] as const)(
  "surfaces %s and terminates the worker",
  async (kind) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { loadCardDatabase } = await import("./load-db");
    const promise = loadCardDatabase(vi.fn());
    const rejected = expect(promise).rejects.toThrow(/failed|receive/);
    const worker = TestWorker.instances[0];
    if (kind === "error") worker.onmessage({ data: { type: "error", message: "Fetch failed" } });
    else if (kind === "onerror") worker.onerror({ message: "Script failed" });
    else worker.onmessageerror();
    await rejected;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    worker.onmessage({ data: { type: "error", message: "Late failure" } });
    expect(error).toHaveBeenCalledExactlyOnceWith("[PodMates] card-database failed (error).");
    error.mockRestore();
  },
);

it.each(["no-worker", "worker-unsupported", "offline"] as const)(
  "uses the main-thread decoder for %s",
  async (kind) => {
    const compressed = await new Response(
      new Blob(['{"gc":[],"banned":[],"cards":[["Example","","","","",0,"",""]]}'])
        .stream()
        .pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer();
    mockDatasetFetch(JSON.stringify(Buffer.from(compressed).toString("base64")));
    if (kind === "no-worker") vi.stubGlobal("Worker", undefined);
    if (kind === "offline") vi.stubGlobal("navigator", { onLine: false });
    const { loadCardDatabase } = await import("./load-db");
    const promise = loadCardDatabase(vi.fn());
    if (kind === "worker-unsupported") {
      const worker = TestWorker.instances[0];
      worker.onmessage({ data: { type: "unsupported" } });
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    }
    const result = await promise;
    expect(result.cards[0].n).toBe("Example");
    expect(result.indexes.byExactName.get("example")).toBe(result.cards[0]);
    if (kind === "offline") expect(TestWorker.instances).toHaveLength(0);
  },
);

it("attempts the legacy path without DecompressionStream and explains the browser requirement", async () => {
  vi.stubGlobal("DecompressionStream", undefined);
  mockDatasetFetch('"H4sI"');
  const { loadCardDatabase } = await import("./load-db");
  await expect(loadCardDatabase(vi.fn())).rejects.toThrow("doesn't support DecompressionStream");
  expect(TestWorker.instances).toHaveLength(0);
});

it("terminates the worker when the manifest fails, without fetching unversioned card data", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
  const { loadCardDatabase } = await import("./load-db");
  await expect(loadCardDatabase(vi.fn())).rejects.toThrow("Could not load dataset manifest");
  expect(TestWorker.instances[0].postMessage).not.toHaveBeenCalled();
  expect(TestWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
});
