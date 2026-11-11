import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildLookupIndexes } from "../cards/lookup";
import type { CardRecord } from "../cards/tuple";
import { loadCardDatabase } from "../cards/load-db";
import { loadDataset, updateDataFreshness } from "../data/load-dataset";
import type { SpellbookSnapshot } from "../engine/context";
import { reportError } from "./report-error";
import { bootCardDatabase, type StaticDatasets } from "./card-db-boot";

vi.mock("../cards/legacy-globals", () => ({}));
vi.mock("../cards/load-db", async () => ({
  buildLookupIndexes: (await import("../cards/lookup")).buildLookupIndexes,
  loadCardDatabase: vi.fn(),
}));
vi.mock("../data/load-dataset", () => ({
  loadDataset: vi.fn(),
  updateDataFreshness: vi.fn(),
}));
vi.mock("./report-error", () => ({ reportError: vi.fn() }));

const card: CardRecord = {
  n: "Example",
  t: "",
  o: "",
  c: "",
  ci: "",
  m: 0,
  p: "",
  r: "",
  g: false,
  b: false,
};
const database = {
  cards: [card],
  compressed: "original card payload",
  indexes: buildLookupIndexes([card]),
};
const snapshot: SpellbookSnapshot = {
  n: ["Example", "Another card"],
  o: ["Win"],
  c: [[[0, 1], 2, 0, 1]],
};
const encoded = gzipSync(JSON.stringify(snapshot)).toString("base64");
const datasets: StaticDatasets = {
  referenceScores: [[1, 2, 3, 4, 5]],
  referenceTiers: ["p"],
  staplesBaseline: { keys: ["ramp"], baselines: { Midrange: { n: 1, ramp: 10 } } },
  manabaseBaseline: { byIdentity: {}, byCount: {} },
  tags: { blink: ["Example"], "extra-combat": [] },
  commanderTiers: [],
};
const values: Record<string, unknown> = {
  REFERENCE_SCORES: datasets.referenceScores,
  REFERENCE_TIERS: datasets.referenceTiers,
  STAPLES_BASELINE: datasets.staplesBaseline,
  MANABASE_BASELINE: datasets.manabaseBaseline,
  tags: datasets.tags,
  winrates: datasets.commanderTiers,
  SPELLBOOK_SNAPSHOT_B64: encoded,
};

function ports() {
  return {
    progress: vi.fn(),
    staticDatasets: vi.fn(),
    database: vi.fn(),
    loadingSpellbook: vi.fn(),
    spellbookSource: vi.fn(),
    spellbook: vi.fn(),
    spellbookError: vi.fn(),
    ready: vi.fn(),
  };
}

beforeEach(() => {
  vi.mocked(loadDataset).mockImplementation(async (name) => values[name]);
  vi.mocked(loadCardDatabase).mockImplementation(async (report) => {
    report("Indexing", 95);
    return database;
  });
  vi.mocked(updateDataFreshness).mockResolvedValue();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

it("waits for required data and freshness before publishing the DB and indexed Spellbook", async () => {
  let release!: () => void;
  vi.mocked(updateDataFreshness).mockReturnValue(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  const page = ports();
  const boot = bootCardDatabase(page);
  await vi.waitFor(() => expect(page.staticDatasets).toHaveBeenCalledWith(datasets));
  expect(page.database).not.toHaveBeenCalled();
  expect(page.ready).not.toHaveBeenCalled();
  release();
  await boot;
  expect(page.database).toHaveBeenCalledWith(database, buildLookupIndexes);
  expect(page.progress).toHaveBeenCalledWith("Indexing", 95);
  expect(page.spellbookSource).toHaveBeenCalledWith(encoded);
  const index = page.spellbook.mock.calls[0][0];
  expect(index.snap).toEqual(snapshot);
  expect(index.nameIdx.get("Example")).toBe(0);
  expect(index.byCard[0]).toEqual([0]);
  expect(page.ready).toHaveBeenCalledWith(
    "Ready — 1 cards and 1 combos (Spellbook lines that win, warp or loop) loaded. You can chart decks now.",
  );
  expect(loadDataset).toHaveBeenCalledTimes(7);
  expect(page.spellbookError).not.toHaveBeenCalled();
});

it.each(["dataset", "freshness", "database", "empty database"])(
  "rejects a required %s failure without marking the app ready",
  async (failure) => {
    const error = new Error("Required data failed");
    if (failure === "dataset") vi.mocked(loadDataset).mockRejectedValue(error);
    if (failure === "freshness") vi.mocked(updateDataFreshness).mockRejectedValue(error);
    if (failure === "database") vi.mocked(loadCardDatabase).mockRejectedValue(error);
    if (failure === "empty database")
      vi.mocked(loadCardDatabase).mockResolvedValue({ ...database, cards: [] });
    const page = ports();
    await expect(bootCardDatabase(page)).rejects.toThrow(
      failure === "empty database" ? "CARD_DB missing or empty" : error.message,
    );
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { operation: "card-database" });
    expect(page.ready).not.toHaveBeenCalled();
    expect(page.loadingSpellbook).not.toHaveBeenCalled();
  },
);

it("keeps analysis available with curated combos when the optional snapshot cannot decode", async () => {
  vi.mocked(loadDataset).mockImplementation(async (name) =>
    name === "SPELLBOOK_SNAPSHOT_B64" ? "invalid base64!" : values[name],
  );
  const page = ports();
  await bootCardDatabase(page);
  expect(page.spellbook).toHaveBeenCalledWith(null);
  expect(page.spellbookError).toHaveBeenCalledWith(expect.any(String));
  expect(page.ready).toHaveBeenCalledWith(
    "Ready — 1 cards loaded. The combo snapshot could not be loaded, so only the built-in combo list is used. You can chart decks now.",
  );
});

it("bounds the optional snapshot wait and clears the deadline after fallback", async () => {
  vi.useFakeTimers();
  const pending = new Promise<string>(() => {});
  vi.mocked(loadDataset).mockImplementation(async (name) =>
    name === "SPELLBOOK_SNAPSHOT_B64" ? pending : values[name],
  );
  const page = ports();
  const boot = bootCardDatabase(page);
  await vi.advanceTimersByTimeAsync(14_999);
  expect(page.ready).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await boot;
  expect(page.spellbookError).toHaveBeenCalledWith(
    "Timed out during: combo snapshot load (waited 15s)",
  );
  expect(page.spellbook).toHaveBeenCalledExactlyOnceWith(null);
  expect(page.ready).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
