import { afterEach, expect, it, vi } from "vitest";
import type { WorkerMessage } from "./db.worker";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function runWorker(response: Response) {
  const messages: WorkerMessage[] = [];
  const scope = {
    onmessage: null as ((event: { data: { url: string } }) => Promise<void>) | null,
    postMessage: (message: WorkerMessage) => messages.push(message),
  };
  vi.stubGlobal("self", scope);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  await import("./db.worker");
  await scope.onmessage!({ data: { url: "https://example.test/PodMates/data/cards.json" } });
  return messages;
}

it("fetches, decodes and indexes in the worker and posts cloneable shared records", async () => {
  const compressed = await new Response(
    new Blob([
      '{"gc":["Front // Back"],"banned":[],"cards":[["Front // Back","","","","",0,"",""]]}',
    ])
      .stream()
      .pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
  const messages = await runWorker(
    new Response(JSON.stringify(Buffer.from(compressed).toString("base64"))),
  );
  expect(fetch).toHaveBeenCalledWith("https://example.test/PodMates/data/cards.json");
  expect(messages.some((message) => message.type === "progress" && message.percent === 65)).toBe(
    true,
  );
  const result = structuredClone(messages.at(-1));
  expect(result?.type).toBe("ready");
  if (result?.type !== "ready") throw new Error("Worker did not finish");
  expect(result.cards[0].g).toBe(true);
  expect(new Map(result.indexes.byFrontFaceName).get("front")).toBe(result.cards[0]);
  expect(new Map(result.indexes.byBackFaceName).get("back")).toBe(result.cards[0]);
});

it.each([
  [new Response("", { status: 503 }), "HTTP 503"],
  [new Response("{}"), "gzip/base64 string"],
  [new Response('"H4sI"'), "Card database worker failed:"],
])("reports fetch/format/decompression failures rather than ready", async (response, error) => {
  const messages = await runWorker(response);
  expect(messages.at(-1)).toMatchObject({ type: "error", message: expect.stringContaining(error) });
  expect(messages.some((message) => message.type === "ready")).toBe(false);
});

it("requests the main-thread fallback when decompression is unavailable in the worker", async () => {
  vi.stubGlobal("DecompressionStream", undefined);
  expect(await runWorker(new Response(""))).toEqual([{ type: "unsupported" }]);
  expect(fetch).not.toHaveBeenCalled();
});
