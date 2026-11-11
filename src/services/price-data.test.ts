// The app-side PriceScry helpers must resolve the same shards and prices as the pipelines that publish them.
import { afterEach, describe, expect, it, vi } from "vitest";
import * as lib from "../../pipelines/lib/pricescry-lib.mjs";
import {
  consensusCents,
  currentYen,
  dayIndex,
  fetchPriceData,
  fmtPct,
  fmtYen,
  fnv1a,
  isoFromDay,
  nameKey,
  PriceDataError,
  priceMarket,
  shardPath,
  valueAt,
  yen,
  type FxData,
  type PriceRecord,
} from "./price-data";

const NAMES = [
  "Sol Ring",
  "  Jace, the Mind Sculptor ",
  "Lim-Dûl's Vault",
  "Lim’Dûl‘s",
  "Ｆｕｌｌｗｉｄｔｈ​",
  "Fire // Ice",
  "",
];

describe("shard helpers (KEEP IN SYNC with pricescry-lib.mjs)", () => {
  it.each(NAMES)("matches the pipeline for %j", (name) => {
    const key = nameKey(name);
    expect(key).toBe(lib.nameKey(name));
    expect(fnv1a(key)).toBe(lib.fnv1a(key));
    expect(shardPath(key)).toBe(lib.shardFile(lib.shardOf(key)));
  });
  it("keeps known shard numbers stable", () => {
    expect(shardPath("sol ring")).toBe("cards/485.json.gz");
  });
  it("converts days and formats values", () => {
    expect(dayIndex("2026-11-10")).toBe(lib.dayIndex("2026-11-10"));
    expect(isoFromDay(2505)).toBe(lib.isoFromDayIndex(2505));
    expect(
      valueAt(
        [
          [10, 1],
          [20, 2],
        ],
        15,
      ),
    ).toBe(1);
    expect(valueAt([[10, 1]], 5)).toBeUndefined();
    expect(fmtYen(1234.6)).toBe("¥1,235");
    expect(fmtYen(null)).toBe("—");
    expect(fmtPct(12.345)).toBe("+12.3%");
    expect(fmtPct(-3)).toBe("-3.0%");
  });
  it("converts cents to yen at the nearest earlier rate", () => {
    const fx: FxData = {
      pairs: {
        usdjpy: [
          [100, 1_500_000],
          [200, 1_600_000],
        ],
      },
    };
    expect(yen(250, "usdjpy", fx, 150)).toBe(375);
    expect(yen(250, "usdjpy", fx, 50)).toBe(375);
    expect(yen(250, "eurjpy", fx, 150)).toBeNull();
  });
});

describe("consensusCents (same rules as consensusAt)", () => {
  const fx: FxData = { pairs: { usdjpy: [[0, 1_500_000]], eurjpy: [[0, 1_650_000]] } };
  const records: PriceRecord[] = [
    {
      n: "A",
      p: [
        {
          id: "1",
          s: "a",
          sn: "A",
          cn: "1",
          pr: { u: [[0, 300]], e: [[0, 200]], xkrn: [[0, 350]] },
        },
        { id: "2", s: "b", sn: "B", cn: "2", pr: { xtrn: [[0, 500]], xmrn: [[0, 450]] } },
      ],
    },
    {
      n: "Foil only",
      p: [{ id: "3", s: "c", sn: "C", cn: "3", pr: { uf: [[0, 900]], ef: [[5, 800]] } }],
    },
    { n: "Nothing", p: [{ id: "4", s: "d", sn: "D", cn: "4", pr: { u: [[0, 0]] } }] },
  ];
  it.each(records)("matches the pipeline for $n", (rec) => {
    const expected = lib.consensusAt(rec, 10, () => 1_650_000 / 1_500_000);
    expect(consensusCents(rec, 10, fx)).toBe(expected ? expected.price : null);
  });
});

describe("fetchPriceData and currentYen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    priceMarket.index = null;
    priceMarket.fx = null;
  });
  it("reads each file once and reports HTTP failures with their status", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("missing.json")
        ? new Response("", { status: 404 })
        : new Response(JSON.stringify({ url })),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchPriceData("test-once.json")).toEqual({
      url: expect.stringContaining("pricescry-data/test-once.json"),
    });
    await fetchPriceData("test-once.json");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const error = await fetchPriceData("missing.json").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PriceDataError);
    expect((error as PriceDataError).status).toBe(404);
  });
  it("is null until the screen has loaded an index, then prices in yen", async () => {
    const rec: PriceRecord = {
      n: "Sol Ring",
      p: [{ id: "1", s: "a", sn: "A", cn: "1", pr: { u: [[0, 200]] } }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(
            JSON.stringify(
              url.endsWith("fx.json")
                ? { pairs: { usdjpy: [[0, 1_500_000]] } }
                : { cards: { "sol ring": rec } },
            ),
          ),
      ),
    );
    expect(await currentYen("Sol Ring")).toBeNull();
    priceMarket.index = { day: "2026-11-10", firstDay: "2026-08-01", cards: 1 };
    expect(await currentYen("Sol Ring")).toBe(300);
    expect(await currentYen("Unknown card")).toBeNull();
  });
});
