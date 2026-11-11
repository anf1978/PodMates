import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, expect, it, vi } from "vitest";
import { downloadBulk, resolveBulk } from "./scryfall-bulk.mjs";
import { sleep } from "./http.mjs";

vi.mock("./http.mjs", async (importOriginal) => ({
  ...(await importOriginal()),
  sleep: vi.fn(async () => {}),
}));

const directories = [];
afterEach(async () => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

it("resolves each exact bulk type, prefers JSONL and keys the current revision", async () => {
  const metadata = {
    type: "oracle_cards",
    updated_at: "2026-11-10T00:00:00Z",
    download_uri: "https://data.scryfall.io/array.json",
    jsonl_download_uri: "https://data.scryfall.io/cards.jsonl",
  };
  const fetch = vi.fn().mockImplementation(async () => Response.json(metadata));
  vi.stubGlobal("fetch", fetch);
  const first = await resolveBulk("oracle_cards");
  expect(first.uri).toBe(metadata.jsonl_download_uri);
  expect(fetch.mock.calls[0][0]).toBe("https://api.scryfall.com/bulk-data/oracle_cards");
  expect(fetch.mock.calls[0][1].headers["User-Agent"]).toContain("PodMates");
  expect(await resolveBulk("oracle_cards")).toEqual(first);
  metadata.updated_at = "2026-11-11T00:00:00Z";
  expect((await resolveBulk("oracle_cards")).key).not.toBe(first.key);
  metadata.type = "default_cards";
  delete metadata.jsonl_download_uri;
  expect((await resolveBulk("default_cards")).uri).toBe(metadata.download_uri);
});

it("rejects mismatched, missing and untrusted metadata", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ type: "default_cards" })));
  await expect(resolveBulk("oracle_cards")).rejects.toThrow("Invalid Scryfall");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        type: "oracle_cards",
        updated_at: "today",
        download_uri: "https://example.com/file",
      }),
    ),
  );
  await expect(resolveBulk("oracle_cards")).rejects.toThrow("Unexpected Scryfall");
  await expect(resolveBulk("unknown")).rejects.toThrow("Unsupported");
});

it.each([false, true])("preserves plain/file-gzip bytes (gzip=%s)", async (gzip) => {
  const directory = await mkdtemp(join(tmpdir(), "pm-bulk-"));
  directories.push(directory);
  const body = Buffer.from('{"name":"Sol Ring"}\n');
  const bytes = gzip ? gzipSync(body) : body;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes)));
  const path = join(directory, "bulk");
  await downloadBulk("https://data.scryfall.io/cards.jsonl", path);
  expect(await readFile(path)).toEqual(bytes);
});

it("retries 429 with Retry-After, but stops immediately on refusal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pm-bulk-"));
  directories.push(directory);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "2" } }))
    .mockResolvedValueOnce(new Response("", { status: 403 }));
  vi.stubGlobal("fetch", fetch);
  const result = expect(
    downloadBulk("https://data.scryfall.io/cards.jsonl", join(directory, "bulk")),
  ).rejects.toThrow("HTTP 403");
  await result;
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(sleep).toHaveBeenCalledWith(2000);
  expect(await readdir(directory)).toEqual([]);
});

it("bounds exhausted retries and does not retry before a long Retry-After", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pm-bulk-"));
  directories.push(directory);
  const fetch = vi.fn().mockImplementation(async () => new Response("", { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  const path = join(directory, "bulk");
  await expect(downloadBulk("https://data.scryfall.io/cards.jsonl", path)).rejects.toThrow(
    "HTTP 503 (attempt 4)",
  );
  expect(fetch).toHaveBeenCalledTimes(4);
  fetch
    .mockClear()
    .mockImplementation(
      async () => new Response("", { status: 429, headers: { "Retry-After": "120" } }),
    );
  await expect(downloadBulk("https://data.scryfall.io/cards.jsonl", path)).rejects.toThrow(
    "retry budget",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("retries network failures but removes partial files on interrupted streams", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pm-bulk-"));
  directories.push(directory);
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("fetch failed"))
    .mockResolvedValueOnce(new Response("data"));
  vi.stubGlobal("fetch", fetch);
  await downloadBulk("https://data.scryfall.io/cards.jsonl", join(directory, "complete"));
  expect(fetch).toHaveBeenCalledTimes(2);
  fetch.mockResolvedValueOnce(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error("stream interrupted"));
        },
      }),
    ),
  );
  await expect(
    downloadBulk("https://data.scryfall.io/cards.jsonl", join(directory, "partial")),
  ).rejects.toThrow("stream interrupted");
  expect(await readdir(directory)).toEqual(["complete"]);
});

it("rejects an empty export and never leaves a cached file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pm-bulk-"));
  directories.push(directory);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("")));
  await expect(
    downloadBulk("https://data.scryfall.io/cards.jsonl", join(directory, "bulk")),
  ).rejects.toThrow("Empty Scryfall");
  expect(await readdir(directory)).toEqual([]);
});
