// PriceScry's published price data: cached fetches from the pricescry-data branch, change-point series,
// yen conversion and the consensus price. Shared by the PriceScry screen, Trades and Ledger.
// Data model and shard layout: src/features/pricescry/CLAUDE.md.

export const PRICE_DATA_BASE = "https://raw.githubusercontent.com/anf1978/PodMates/pricescry-data/";
const SHARDS = 512;
const EPOCH_MS = Date.UTC(2020, 0, 1);

/** Change points: `[[day, value], …]` means "value from that day until the next point". */
export type Series = readonly (readonly [number, number])[];
export interface FxData {
  pairs?: Partial<Record<string, Series>>;
}
export interface PriceIndex {
  day: string;
  firstDay: string;
  cards: number;
}
export interface Printing {
  id: string;
  s: string;
  sn: string;
  cn: string;
  r?: string;
  pr: Partial<Record<string, Series>>;
}
export interface JpSeries {
  shop: string;
  lang?: string;
  finish?: string;
  printing?: string;
  s: Series;
}
export interface PriceRecord {
  n: string;
  rs?: unknown;
  gc?: unknown;
  er?: number;
  ers?: readonly (readonly [number, number | null])[];
  p: Printing[];
  jp?: JpSeries[];
}
export interface Shard {
  cards?: Record<string, PriceRecord | undefined>;
}

/** The loaded index and exchange rates, shared by the screen and the trade price lookups. */
export const priceMarket: { index: PriceIndex | null; fx: FxData | null } = {
  index: null,
  fx: null,
};

// ---- helpers kept identical to pipelines/lib/pricescry-lib.mjs ------------
// KEEP IN SYNC: nameKey(), fnv1a() and the shard path match nameKey(), fnv1a() and shardOf() there, or the
// page looks for cards in the wrong files. price-data.test.ts compares them.
export function nameKey(name: unknown): string {
  return (
    String(name == null ? "" : name)
      .normalize("NFKC")
      .replace(/[\u0000-\u001F\u007F​-‏⁠﻿]/g, "")
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
}
export function fnv1a(str: string): number {
  const bytes = new TextEncoder().encode(str);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
export function shardPath(key: string): string {
  return "cards/" + String(fnv1a(key) % SHARDS).padStart(3, "0") + ".json.gz";
}
export function dayIndex(iso: string): number {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH_MS) / 86400000);
}
export function isoFromDay(d: number): string {
  return new Date(EPOCH_MS + d * 86400000).toISOString().slice(0, 10);
}
export function valueAt(series: Series, day: number): number | undefined {
  let v: number | undefined;
  for (let i = 0; i < series.length; i++) {
    if (series[i]![0] <= day) v = series[i]![1];
    else break;
  }
  return v;
}
/** Yen per USD / EUR on a day: the nearest earlier published rate (weekends and holidays have none). */
export function fxAt(fx: FxData | null, pair: string, day: number): number | null {
  const s = fx && fx.pairs && fx.pairs[pair];
  if (!s || !s.length) return null;
  const v = valueAt(s, day);
  return (v === undefined ? s[0]![1] : v) / 10000;
}
export function yen(
  cents: number | null | undefined,
  pair: string,
  fx: FxData | null,
  day: number,
): number | null {
  if (cents == null) return null;
  const rate = fxAt(fx, pair, day);
  return rate == null ? null : (cents / 100) * rate;
}
export function fmtYen(v: number | null | undefined): string {
  return v == null ? "—" : "¥" + Math.round(v).toLocaleString("en-US");
}
export function fmtPct(p: number | null | undefined): string {
  return p == null ? "—" : (p > 0 ? "+" : "") + p.toFixed(1) + "%";
}

export class PriceDataError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
const cache = new Map<string, unknown>();
/** Reads one published file once per page load; gzip files are unzipped unless the server already did. */
export async function fetchPriceData<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T;
  const res = await fetch(PRICE_DATA_BASE + path);
  if (!res.ok) throw new PriceDataError(`HTTP ${res.status} for ${path}`, res.status);
  const buf = await res.arrayBuffer();
  const b = new Uint8Array(buf);
  let text: string;
  if (b[0] === 0x1f && b[1] === 0x8b) {
    text = await new Response(
      new Response(buf).body!.pipeThrough(new DecompressionStream("gzip")),
    ).text();
  } else {
    text = new TextDecoder().decode(b);
  }
  const data: unknown = JSON.parse(text);
  cache.set(path, data);
  return data as T;
}

/** The consensus price (middle across shops) in cents: same rules as consensusAt in pricescry-lib.mjs. */
export function consensusCents(rec: PriceRecord, day: number, fx: FxData | null): number | null {
  const eur = (): number => {
    const e = fx && fx.pairs && fx.pairs.eurjpy,
      u = fx && fx.pairs && fx.pairs.usdjpy;
    if (!e || !u || !e.length || !u.length) return 1.1;
    return (valueAt(e, day) ?? e[0]![1]) / (valueAt(u, day) ?? u[0]![1]);
  };
  const legacy: Record<string, [string, string | null]> = {
    n: ["u", "e"],
    f: ["uf", "ef"],
    e: ["ue", null],
  };
  for (const f of ["n", "f"]) {
    let best: number | null = null;
    for (const p of rec.p) {
      const vals: number[] = [];
      const add = (mjKey: string, legKey: string | null, isEur: boolean): void => {
        const mj = p.pr[mjKey];
        const ser = mj && mj.length ? mj : legKey ? p.pr[legKey] : null;
        if (!ser || !ser.length) return;
        const v = valueAt(ser, day);
        if (v == null || v <= 0) return;
        vals.push(isEur ? Math.round(v * eur()) : v);
      };
      add("xtr" + f, legacy[f]![0], false);
      add("xcr" + f, legacy[f]![1], true);
      add("xkr" + f, null, false);
      add("xmr" + f, null, false);
      if (!vals.length) continue;
      vals.sort((a, b) => a - b);
      const m = vals.length >> 1,
        med = vals.length % 2 ? vals[m]! : Math.round((vals[m - 1]! + vals[m]!) / 2);
      if (best === null || med < best) best = med;
    }
    if (best !== null) return best;
  }
  return null;
}

/** The card's consensus price now, in yen per card, or null (also before the screen loaded its index). */
export async function currentYen(cardName: string): Promise<number | null> {
  try {
    const key = nameKey(cardName),
      shard = await fetchPriceData<Shard>(shardPath(key)),
      rec = shard.cards && shard.cards[key];
    if (!rec || !priceMarket.index) return null;
    if (!priceMarket.fx) {
      try {
        priceMarket.fx = await fetchPriceData<FxData>("fx.json");
      } catch {
        return null;
      }
    }
    const day = dayIndex(priceMarket.index.day),
      cents = consensusCents(rec, day, priceMarket.fx);
    return cents == null ? null : yen(cents, "usdjpy", priceMarket.fx, day);
  } catch {
    return null;
  }
}
