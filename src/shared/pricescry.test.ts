// Fixed vectors taken from the published pipeline before the copies were merged: if a shard number changes, every
// card in that shard on the pricescry-data branch becomes unreachable from the page.
import { describe, expect, it } from "vitest";
import {
  consensusAt,
  dayIndex,
  fnv1a,
  isoFromDayIndex,
  makeEurUsd,
  nameKey,
  shardFile,
  shardOf,
  sourceValuesAt,
  valueAt,
  type PricedPrinting,
} from "./pricescry";

const NAMES: [name: string, key: string, hash: number, shard: number][] = [
  ["Sol Ring", "sol ring", 1431542757, 485],
  ["  Jace, the Mind Sculptor ", "jace, the mind sculptor", 1622868521, 41],
  ["Lim-Dûl's Vault", "lim-dûl's vault", 3771117020, 476],
  ["Lim’Dûl‘s", "lim'dûl's", 1604054086, 70],
  ["Ｆｕｌｌｗｉｄｔｈ​", "fullwidth", 678388872, 136],
  ["Fire // Ice", "fire // ice", 4092637966, 270],
  ["", "", 2166136261, 453],
  ["Black Lotus", "black lotus", 11404491, 203],
  ["Atraxa, Praetors' Voice", "atraxa, praetors' voice", 2765681215, 63],
];

describe("name key and shard hash", () => {
  it.each(NAMES)("keeps %j in its published shard", (name, key, hash, shard) => {
    expect(nameKey(name)).toBe(key);
    expect(fnv1a(key)).toBe(hash);
    expect(shardOf(key)).toBe(shard);
  });
  it("names shard files with three digits", () => {
    expect(shardFile(485)).toBe("cards/485.json.gz");
    expect(shardFile(7)).toBe("cards/007.json.gz");
  });
  it("treats null and undefined as an empty name", () => {
    expect(nameKey(null)).toBe("");
    expect(nameKey(undefined)).toBe("");
  });
});

describe("days and change points", () => {
  it("counts whole days from 2020-01-01 UTC", () => {
    expect(dayIndex("2020-01-01")).toBe(0);
    expect(dayIndex("2026-11-10")).toBe(2505);
    expect(dayIndex("2026-11-10T23:59:00Z")).toBe(2505);
    expect(isoFromDayIndex(2505)).toBe("2026-11-10");
  });
  it("reads the value in force on a day", () => {
    const s: [number, number | null][] = [
      [10, 1],
      [20, null],
      [30, 3],
    ];
    expect(valueAt(s, 5)).toBeUndefined();
    expect(valueAt(s, 15)).toBe(1);
    expect(valueAt(s, 25)).toBeNull();
    expect(valueAt(s, 99)).toBe(3);
  });
});

describe("consensus price", () => {
  const fx = { pairs: { usdjpy: [[0, 1_500_000]], eurjpy: [[0, 1_650_000]] } } as const;
  const eurUsd = makeEurUsd(fx);
  const printing = (id: string, pr: PricedPrinting["pr"]) => ({ id, pr });
  const twoPrintings = {
    p: [
      printing("1", { u: [[0, 300]], e: [[0, 200]], xkrn: [[0, 350]] }),
      printing("2", { xtrn: [[0, 500]], xmrn: [[0, 450]] }),
    ],
  };
  const foilOnly = { p: [printing("3", { uf: [[0, 900]], ef: [[5, 800]] })] };

  it("converts euros with fx.json, or 1.1 without it", () => {
    expect(eurUsd(10)).toBe(1.1);
    expect(makeEurUsd(null)(10)).toBe(1.1);
    expect(makeEurUsd({ pairs: { usdjpy: [[0, 1_000_000]], eurjpy: [[0, 1_200_000]] } })(3)).toBe(
      1.2,
    );
  });
  it("takes the cheapest printing's middle shop price", () => {
    const c = consensusAt(twoPrintings, 10, eurUsd);
    expect(c).toMatchObject({ price: 300, n: 3, finish: "n" });
    expect(c!.printing.id).toBe("1");
    expect(c!.sources).toEqual([
      { src: "tcgplayer", cents: 300 },
      { src: "cardmarket", cents: 220 },
      { src: "cardkingdom", cents: 350 },
    ]);
  });
  it("falls back to foil and averages an even middle", () => {
    expect(consensusAt(foilOnly, 3, eurUsd)).toMatchObject({ price: 900, n: 1, finish: "f" });
    expect(consensusAt(foilOnly, 10, eurUsd)).toMatchObject({ price: 890, n: 2, finish: "f" });
  });
  it("ignores zero and missing prices", () => {
    expect(consensusAt({ p: [printing("4", { u: [[0, 0]] })] }, 10, eurUsd)).toBeNull();
    expect(consensusAt({ p: [] }, 10)).toBeNull();
  });
  it("prefers MTGJSON's TCGplayer series over Scryfall's copy of it", () => {
    const p = printing("5", { u: [[0, 100]], xtrn: [[0, 120]] });
    expect(sourceValuesAt(p, "n", 1)).toEqual([{ src: "tcgplayer", cents: 120 }]);
  });
});
