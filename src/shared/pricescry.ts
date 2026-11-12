// PriceScry helpers used by BOTH the page (src/services/price-data.ts) and the pipelines that publish the data
// (pipelines/lib/pricescry-lib.mjs re-exports them). One copy, so the page always looks for a card in the shard
// the pipeline wrote it to and prices it by the same rules.
//
// Node runs this file directly (built-in type stripping, Node 22.18+), so keep it to erasable TypeScript: no
// enums, namespaces or parameter properties, `import type` for types, and `.ts` on relative imports. No DOM and
// no Node-only APIs. src/shared imports nothing from other src/ folders (lint).

/** Day 0 of every series: 2020-01-01 UTC. */
export const EPOCH_MS = Date.UTC(2020, 0, 1);
/** Cards are spread over this many shard files. Changing it makes every published shard unreachable. */
export const SHARDS = 512;

/** Change points: `[[day, value], …]` means "value from that day until the next point". */
export type ChangePoints<V = number | null> = readonly (readonly [number, V])[];

/** Whole days since 2020-01-01 UTC for an ISO date ("2026-11-10", time ignored). */
export function dayIndex(iso: string): number {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH_MS) / 86400000);
}
export function isoFromDayIndex(d: number): string {
  return new Date(EPOCH_MS + d * 86400000).toISOString().slice(0, 10);
}

// Case, spacing and invisible characters never change which card a name means.
export function nameKey(name: unknown): string {
  return String(name == null ? "" : name)
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F​-‏⁠﻿]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
/** 32-bit FNV-1a over the UTF-8 bytes. */
export function fnv1a(str: string): number {
  const bytes = new TextEncoder().encode(str);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
/** The shard number of a `nameKey()`. */
export function shardOf(key: string): number {
  return fnv1a(key) % SHARDS;
}
/** The published path of shard `n`, e.g. `cards/007.json.gz`. */
export function shardFile(n: number): string {
  return `cards/${String(n).padStart(3, "0")}.json.gz`;
}

/** Value in force on `day`, or undefined if the series had not started yet. */
export function valueAt<V>(series: ChangePoints<V>, day: number): V | undefined {
  let v: V | undefined;
  for (let i = 0; i < series.length; i++) {
    if (series[i]![0] <= day) v = series[i]![1];
    else break;
  }
  return v;
}

// ---- consensus price across shops -------------------------------------------------------------
// One shop's price can be wrong or move on a handful of copies. The consensus for a printing on a day is the MIDDLE
// (median) of the shops that price it: TCGplayer, Cardmarket (euros converted to dollars), Card Kingdom, Manapool.
// TCGplayer is never counted twice: when MTGJSON's TCGplayer series exists, Scryfall's (which comes from the same
// shop) is ignored. A card's consensus is that of its cheapest non-foil printing (foil only if it has no non-foil price),
// because that is what a buyer would buy. Cards with no MTGJSON data at all keep the older Scryfall-only behaviour.

/** Exchange rates as published in fx.json: yen × 10,000 per USD (`usdjpy`) / EUR (`eurjpy`). */
export interface FxRates {
  pairs?: Partial<Record<string, ChangePoints<number>>>;
}
/** A printing's price series by key (`u`, `e`, `xtrn`, …). */
export interface PricedPrinting {
  pr: Partial<Record<string, ChangePoints>>;
}
export interface SourceValue {
  src: "tcgplayer" | "cardmarket" | "cardkingdom" | "manapool";
  cents: number;
}
export interface Consensus<P> {
  price: number;
  n: number;
  printing: P;
  finish: "n" | "f";
  sources: SourceValue[];
}
export type EurUsd = (day: number) => number;

/** Dollars per euro on a day, from fx.json; 1.1 when the rates are missing. */
export function makeEurUsd(fx: FxRates | null | undefined): EurUsd {
  const eur = fx && fx.pairs && fx.pairs.eurjpy,
    usd = fx && fx.pairs && fx.pairs.usdjpy;
  if (!eur || !usd || !eur.length || !usd.length) return () => 1.1;
  return (day) => {
    const e = valueAt(eur, day) ?? eur[0]![1],
      u = valueAt(usd, day) ?? usd[0]![1];
    return e / u;
  };
}
const FIN_LEGACY: Record<string, { us: string; eu: string | null }> = {
  n: { us: "u", eu: "e" },
  f: { us: "uf", eu: "ef" },
  e: { us: "ue", eu: null },
};
/** Each shop's retail price for one printing and finish (`n`, `f`, `e`) on a day, in US cents. */
export function sourceValuesAt(
  p: PricedPrinting,
  f: string,
  day: number,
  eurUsd: EurUsd = () => 1.1,
): SourceValue[] {
  const out: SourceValue[] = [];
  const add = (
    src: SourceValue["src"],
    mjSeries: ChangePoints | undefined,
    legacyKey: string | null,
    isEur: boolean,
  ): void => {
    const ser = mjSeries && mjSeries.length ? mjSeries : legacyKey ? p.pr[legacyKey] : null;
    if (!ser || !ser.length) return;
    const v = valueAt(ser, day);
    if (v == null || v <= 0) return; // undefined = history not started, null = no price that day
    out.push({ src, cents: isEur ? Math.round(v * eurUsd(day)) : v });
  };
  add("tcgplayer", p.pr["xtr" + f], FIN_LEGACY[f]!.us, false);
  add("cardmarket", p.pr["xcr" + f], FIN_LEGACY[f]!.eu, true);
  add("cardkingdom", p.pr["xkr" + f], null, false);
  add("manapool", p.pr["xmr" + f], null, false);
  return out;
}
const medianOf = (a: readonly number[]): number => {
  const s = [...a].sort((x, y) => x - y),
    m = s.length >> 1;
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};
/** The card's consensus price on a day (cheapest printing's middle shop price), or null. */
export function consensusAt<P extends PricedPrinting>(
  rec: { readonly p: readonly P[] },
  day: number,
  eurUsd: EurUsd = () => 1.1,
): Consensus<P> | null {
  for (const f of ["n", "f"] as const) {
    let best: Consensus<P> | null = null;
    for (const p of rec.p) {
      const vals = sourceValuesAt(p, f, day, eurUsd);
      if (!vals.length) continue;
      const price = medianOf(vals.map((v) => v.cents));
      if (!best || price < best.price)
        best = { price, n: vals.length, printing: p, finish: f, sources: vals };
    }
    if (best) return best;
  }
  return null;
}
