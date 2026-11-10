import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("uses the deployment base and shares one request and promise per dataset", async () => {
  vi.stubEnv("BASE_URL", "/PodMates/");
  const fetchDataset = vi.fn().mockResolvedValue(new Response('{"cards":[]}'));
  vi.stubGlobal("fetch", fetchDataset);
  const { loadDataset } = await import("./load-dataset");
  const first = loadDataset<{ cards: unknown[] }>("KNOW_JSON");
  expect(loadDataset("KNOW_JSON")).toBe(first);
  await expect(first).resolves.toEqual({ cards: [] });
  expect(fetchDataset).toHaveBeenCalledExactlyOnceWith(
    "/PodMates/data/KNOW_JSON.json",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

it.each([
  [new Response("", { status: 503 }), "HTTP 503"],
  [new Response("not JSON"), "JSON"],
])("rejects failed or malformed datasets without a success fallback", async (response, error) => {
  const fetchDataset = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchDataset);
  const { loadDataset } = await import("./load-dataset");
  const promise = loadDataset("KNOW_JSON");
  await expect(promise).rejects.toThrow("Could not load dataset KNOW_JSON");
  await expect(promise).rejects.toThrow(error);
  expect(loadDataset("KNOW_JSON")).toBe(promise);
  expect(fetchDataset).toHaveBeenCalledTimes(1);
});

it("reports completed fetches to the boot bar without overwriting ready state", async () => {
  const message = { textContent: "" };
  const fill = { classList: { remove: vi.fn() }, style: { width: "" } };
  const bootWindow = { __dbLoadPct: 8, __dbReady: false };
  vi.stubGlobal("window", bootWindow);
  vi.stubGlobal("document", {
    getElementById: (id: string) => (id === "dbStatus" ? message : fill),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]")));
  const { loadDataset } = await import("./load-dataset");
  await loadDataset("REFERENCE_SCORES");
  expect(message.textContent).toContain("(1/1 datasets)");
  expect(fill.style.width).toBe("78%");
  bootWindow.__dbReady = true;
  message.textContent = "Ready";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]")));
  await loadDataset("REFERENCE_TIERS");
  expect(message.textContent).toBe("Ready");
});

it("rejects paths rather than fetching outside the dataset directory", async () => {
  const fetchDataset = vi.fn();
  vi.stubGlobal("fetch", fetchDataset);
  const { loadDataset } = await import("./load-dataset");
  expect(() => loadDataset("../index")).toThrow("Invalid dataset name");
  expect(fetchDataset).not.toHaveBeenCalled();
});
