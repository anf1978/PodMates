// PriceScry's published price data: cached fetches from the pricescry-data branch, change-point series,
// yen conversion and the consensus price. Shared by the PriceScry screen, Trades and Ledger.
// Data model and shard layout: src/features/pricescry/CLAUDE.md. The name key, shard hash, day numbers and
// consensus rules come from src/shared/pricescry.ts, the same code the publishing pipelines run.
import {
  consensusAt,
  dayIndex,
  makeEurUsd,
  nameKey,
  shardFile,
  shardOf,
  valueAt,
} from "../shared/pricescry";

export { dayIndex, isoFromDayIndex as isoFromDay, nameKey, valueAt } from "../shared/pricescry";

export const PRICE_DATA_BASE = "https://raw.githubusercontent.com/anf1978/PodMates/pricescry-data/";

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

/** The published shard file holding the card with this `nameKey()`. */
export function shardPath(key: string): string {
  return shardFile(shardOf(key));
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

/** The consensus price (middle across shops) in cents, or null: `consensusAt` with fx.json's euro rate. */
export function consensusCents(rec: PriceRecord, day: number, fx: FxData | null): number | null {
  const c = consensusAt(rec, day, makeEurUsd(fx));
  return c ? c.price : null;
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
