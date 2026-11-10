import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.useRealTimers();
});

const metadata = {
  version: "a1",
  generatedAt: "2026-11-10T00:00:00.000Z",
  sha256: "a".repeat(64),
  bytes: 12,
  source: "Test pipeline",
};
const manifest = {
  files: Object.fromEntries(
    ["KNOW_JSON", "REFERENCE_SCORES", "REFERENCE_TIERS", "cards", "winrates"].map((name) => [
      `${name}.json`,
      metadata,
    ]),
  ),
};

function mockFetch(response: () => Response) {
  const fetchDataset = vi.fn(async (url: string) =>
    url.endsWith("manifest.json") ? Response.json(manifest) : response(),
  );
  vi.stubGlobal("fetch", fetchDataset);
  return fetchDataset;
}

it("uses the deployment base and shares one request and promise per dataset", async () => {
  vi.stubEnv("BASE_URL", "/PodMates/");
  const fetchDataset = mockFetch(() => new Response('{"cards":[]}'));
  const { loadDataset } = await import("./load-dataset");
  const first = loadDataset<{ cards: unknown[] }>("KNOW_JSON");
  expect(loadDataset("KNOW_JSON")).toBe(first);
  await expect(first).resolves.toEqual({ cards: [] });
  expect(fetchDataset).toHaveBeenNthCalledWith(
    1,
    "/PodMates/data/manifest.json",
    expect.objectContaining({ cache: "no-cache" }),
  );
  expect(fetchDataset).toHaveBeenNthCalledWith(
    2,
    `/PodMates/data/KNOW_JSON.json?v=${metadata.sha256}`,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  await loadDataset("REFERENCE_TIERS");
  expect(fetchDataset.mock.calls.filter(([url]) => url.endsWith("manifest.json"))).toHaveLength(1);
});

it.each([
  [new Response("", { status: 503 }), "HTTP 503"],
  [new Response("not JSON"), "JSON"],
])("rejects failed or malformed datasets without a success fallback", async (response, error) => {
  const fetchDataset = mockFetch(() => response);
  const { loadDataset } = await import("./load-dataset");
  const promise = loadDataset("KNOW_JSON");
  await expect(promise).rejects.toThrow("Could not load dataset KNOW_JSON");
  await expect(promise).rejects.toThrow(error);
  expect(loadDataset("KNOW_JSON")).toBe(promise);
  expect(fetchDataset).toHaveBeenCalledTimes(2);
});

it("reports completed fetches to the boot bar without overwriting ready state", async () => {
  const message = { textContent: "" };
  const fill = { classList: { remove: vi.fn() }, style: { width: "" } };
  const bootWindow = { __dbLoadPct: 8, __dbReady: false, __dbProgress: vi.fn() };
  vi.stubGlobal("window", bootWindow);
  vi.stubGlobal("document", {
    getElementById: (id: string) => (id === "dbStatus" ? message : fill),
  });
  mockFetch(() => new Response("[]"));
  const { loadDataset } = await import("./load-dataset");
  await loadDataset("REFERENCE_SCORES");
  expect(message.textContent).toContain("(1/1 datasets)");
  expect(fill.style.width).toBe("20%");
  expect(bootWindow.__dbProgress).toHaveBeenCalledTimes(2);
  bootWindow.__dbReady = true;
  message.textContent = "Ready";
  await loadDataset("REFERENCE_TIERS");
  expect(message.textContent).toBe("Ready");
});

it.each([
  [new Response("", { status: 503 }), "HTTP 503"],
  [Response.json({ files: { "cards.json": { ...metadata, sha256: "bad" } } }), "Invalid metadata"],
])("rejects a failed or invalid manifest before requesting data", async (response, error) => {
  const fetchDataset = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchDataset);
  const { loadDataset } = await import("./load-dataset");
  await expect(loadDataset("cards")).rejects.toThrow(error);
  expect(fetchDataset).toHaveBeenCalledTimes(1);
});

it("rejects a dataset absent from the manifest", async () => {
  const fetchDataset = mockFetch(() => new Response("[]"));
  const { loadDataset } = await import("./load-dataset");
  await expect(loadDataset("missing")).rejects.toThrow("Dataset missing from manifest");
  expect(fetchDataset).toHaveBeenCalledTimes(1);
});

it.each([
  ["2026-11-24T00:00:00.000Z", false],
  ["2026-11-24T00:00:00.001Z", true],
])("shows dataset dates and warns only beyond 14 days (%s)", async (now, stale) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));
  const footer = { textContent: "" };
  vi.stubGlobal("document", { getElementById: () => footer });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  mockFetch(() => new Response("[]"));
  const { updateDataFreshness } = await import("./load-dataset");
  try {
    await updateDataFreshness();
    expect(footer.textContent).toContain("Card data as of 2026-11-10 · Win-rates as of 2026-11-10");
    expect(footer.textContent.includes("over 14 days old")).toBe(stale);
    expect(warn).toHaveBeenCalledTimes(stale ? 1 : 0);
  } finally {
    warn.mockRestore();
  }
});

it("rejects paths rather than fetching outside the dataset directory", async () => {
  const fetchDataset = vi.fn();
  vi.stubGlobal("fetch", fetchDataset);
  const { loadDataset } = await import("./load-dataset");
  expect(() => loadDataset("../index")).toThrow("Invalid dataset name");
  expect(fetchDataset).not.toHaveBeenCalled();
});
