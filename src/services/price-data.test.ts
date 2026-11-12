// The page-side PriceScry helpers. Shard hashing and the consensus rules themselves are pinned in
// src/shared/pricescry.test.ts; these check the page's wrappers around them.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consensusCents,
  currentYen,
  fetchPriceData,
  fmtPct,
  fmtYen,
  isoFromDay,
  PriceDataError,
  priceMarket,
  shardPath,
  yen,
  type FxData,
  type PriceRecord,
} from "./price-data";

describe("page price helpers", () => {
  it("resolves the shard file a name key lives in", () => {
    expect(shardPath("sol ring")).toBe("cards/485.json.gz");
    expect(shardPath("black lotus")).toBe("cards/203.json.gz");
  });
  it("formats days and values", () => {
    expect(isoFromDay(2505)).toBe("2026-11-10");
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

describe("consensusCents", () => {
  const fx: FxData = { pairs: { usdjpy: [[0, 1_500_000]], eurjpy: [[0, 1_650_000]] } };
  const records: [PriceRecord, number | null][] = [
    [
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
      300,
    ],
    [
      {
        n: "Foil only",
        p: [{ id: "3", s: "c", sn: "C", cn: "3", pr: { uf: [[0, 900]], ef: [[5, 800]] } }],
      },
      890,
    ],
    [{ n: "Nothing", p: [{ id: "4", s: "d", sn: "D", cn: "4", pr: { u: [[0, 0]] } }] }, null],
  ];
  it.each(records)("prices %j", (rec, expected) => {
    expect(consensusCents(rec, 10, fx)).toBe(expected);
  });
  it("uses the default euro rate without fx.json", () => {
    expect(consensusCents(records[1]![0], 10, null)).toBe(890);
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
