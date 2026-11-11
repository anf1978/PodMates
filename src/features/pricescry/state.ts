// Screen state and the pure price logic behind the card page, chart and Signals tab.
import {
  dayIndex,
  priceMarket,
  valueAt,
  yen,
  nameKey,
  type FxData,
  type Printing,
  type PriceRecord,
  type Series,
} from "../../services/price-data";

export type Tab = "search" | "movers" | "signals" | "bait" | "radar" | "ledger";
export type Finish = "nonfoil" | "foil" | "etched";
export interface Signal {
  type: string;
  n: string;
  k?: string;
  day: number;
  set?: string;
  setName?: string;
  releases?: string;
  preview?: { s?: string };
  format?: string;
  from?: unknown;
  to?: unknown;
}
export interface MoverRow {
  n: string;
  now: number;
  pct: number;
  shops?: number;
  of?: number;
}
export interface Movers {
  day: string;
  v?: number;
  windows: Record<string, { up: MoverRow[]; down: MoverRow[]; considered: number } | undefined>;
}

export const psState = {
  tab: "search" as Tab,
  rec: null as PriceRecord | null,
  printingId: null as string | null,
  finish: "nonfoil" as Finish,
  range: "90",
  movers: null as Movers | null,
  moverWindow: "7",
  moverDir: "up",
  signals: null as Signal[] | null,
  signalType: "all",
  origin: null as { tab: Tab; top: number } | null,
  q: "",
  shadow: null as unknown,
  cheap: null as unknown,
  radar: null as unknown,
};

// Which price series belong to each finish.
const FINISH_SERIES: Record<Finish, { us: string; eu: string | null }> = {
  nonfoil: { us: "u", eu: "e" },
  foil: { us: "uf", eu: "ef" },
  etched: { us: "ue", eu: null },
};
export const FINISH_LABEL: Record<Finish, string> = {
  nonfoil: "Non-foil",
  foil: "Foil",
  etched: "Etched foil",
};
// MTGJSON shop series, stored per printing as "x" + provider + kind + finish (see pricescry-lib.mjs, mjKey):
// provider t=TCGplayer c=Cardmarket k=Card Kingdom m=Manapool; kind r=retail b=buylist; finish n/f/e.
const MJ: Record<string, string> = { us: "xtr", eu: "xcr", ck: "xkr", mana: "xmr", ckBuy: "xkb" };
const FIN_LETTER: Record<Finish, string> = { nonfoil: "n", foil: "f", etched: "e" };
export type Source = "us" | "eu" | "ck" | "mana" | "ckBuy";

/** One source's series for a printing and finish. MTGJSON wins for US/EU when present (it has back-filled history). */
export function seriesFor(printing: Printing, finish: Finish, which: Source): Series | undefined {
  const keys = FINISH_SERIES[finish] || FINISH_SERIES.nonfoil;
  const mj = MJ[which] ? printing.pr[MJ[which] + FIN_LETTER[finish]] : null;
  if (mj && mj.length) return mj;
  if (which === "us") return printing.pr[keys.us];
  if (which === "eu") return keys.eu ? printing.pr[keys.eu] : undefined;
  return undefined;
}

/** The printing a card page opens on: the cheapest non-foil with a price, else the last printing. */
export function defaultPrinting(rec: PriceRecord): { id: string | null; finish: Finish } {
  const nf = (p: Printing): Series | undefined => seriesFor(p, "nonfoil", "us");
  const cheapest = rec.p
    .filter((p) => p.pr && nf(p) && nf(p)!.length)
    .sort((a, b) => valueAt(nf(a)!, 1e9)! - valueAt(nf(b)!, 1e9)!)[0];
  return {
    id: (cheapest || rec.p[rec.p.length - 1] || { id: null }).id || null,
    finish: cheapest ? "nonfoil" : "foil",
  };
}

export interface ChartLine {
  id: string;
  label: string;
  series: Series;
  pair: string | null;
  native: "USD" | "EUR" | "JPY";
  color: string;
  dashed?: boolean;
  pts: { day: number; v: number | null; raw: number | undefined }[];
}
export interface ChartModel {
  lines: ChartLine[];
  startDay: number;
  endDay: number;
  haveFx: boolean;
}

function point(def: Omit<ChartLine, "pts">, day: number, haveFx: boolean, fx: FxData | null) {
  const raw = valueAt(def.series, day);
  if (raw == null) return { day, v: null, raw };
  if (def.native === "JPY") return { day, v: raw, raw };
  return { day, v: haveFx ? yen(raw, def.pair!, fx, day) : raw / 100, raw };
}

/** The chart's lines: one value per sampled day (at most ~300), in yen where a rate exists. */
export function buildChart(
  rec: PriceRecord,
  printing: Printing,
  finish: Finish,
  range: string,
  endDay: number,
  fx: FxData | null,
): ChartModel {
  const defs: Omit<ChartLine, "pts">[] = [];
  const add = (which: Source, def: Omit<ChartLine, "pts" | "series">): void => {
    const series = seriesFor(printing, finish, which);
    if (series) defs.push({ ...def, series });
  };
  add("us", {
    id: "us",
    label: "US market (TCGplayer)",
    pair: "usdjpy",
    native: "USD",
    color: "#d4a935",
  });
  add("eu", {
    id: "eu",
    label: "EU market (Cardmarket)",
    pair: "eurjpy",
    native: "EUR",
    color: "#5aa7d6",
  });
  add("ck", {
    id: "ck",
    label: "Card Kingdom (US shop)",
    pair: "usdjpy",
    native: "USD",
    color: "#a07ad8",
  });
  add("mana", {
    id: "mana",
    label: "Manapool (US)",
    pair: "usdjpy",
    native: "USD",
    color: "#4fb286",
  });
  add("ckBuy", {
    id: "ckbuy",
    label: "Card Kingdom buylist (what they pay)",
    pair: "usdjpy",
    native: "USD",
    color: "#9a9a9a",
    dashed: true,
  });
  for (const j of rec.jp || []) {
    if (j.finish && j.finish !== finish) continue;
    if (j.printing && j.printing !== printing.id) continue;
    const label = `${j.shop}${j.lang ? " (" + j.lang.toUpperCase() + ")" : ""}`;
    defs.push({
      id: "jp-" + j.shop + (j.lang || ""),
      label,
      series: j.s,
      pair: null,
      native: "JPY",
      color: "#e0605a",
      dashed: true,
    });
  }
  let first = endDay;
  defs.forEach((d) => {
    if (d.series.length) first = Math.min(first, d.series[0]![0]);
  });
  const startDay = range === "all" ? first : Math.max(first, endDay - Number(range) + 1);
  const span = Math.max(1, endDay - startDay);
  const stride = Math.max(1, Math.ceil(span / 300));
  const haveFx = !!(fx && fx.pairs && fx.pairs.usdjpy && fx.pairs.usdjpy.length);
  const lines = defs
    .map((d) => {
      const pts = [];
      for (let day = startDay; day <= endDay; day += stride) pts.push(point(d, day, haveFx, fx));
      if ((endDay - startDay) % stride !== 0) pts.push(point(d, endDay, haveFx, fx));
      return { ...d, pts };
    })
    .filter((l) => l.pts.some((p) => p.v != null));
  return { lines, startDay, endDay, haveFx };
}

export function pctChange(series: Series, endDay: number, days: number): number | null {
  const now = valueAt(series, endDay),
    then = valueAt(series, endDay - days);
  if (now == null || then == null || then === 0) return null;
  return ((now - then) / then) * 100;
}

/** Reprints seen in the daily signals during the last 90 days, if the signals have been loaded. */
export function recentReprints(rec: PriceRecord): Signal[] {
  if (!psState.signals || !priceMarket.index) return [];
  const key = nameKey(rec.n),
    cutoff = dayIndex(priceMarket.index.day) - 90;
  return psState.signals.filter((e) => e.type === "new_printing" && e.k === key && e.day >= cutoff);
}

export const SIGNAL_GROUPS: Record<string, string[] | null> = {
  all: null,
  reprints: ["new_printing"],
  bans: ["legality"],
  newcards: ["new_card"],
  demand: ["rank_jump", "game_changer"],
};
/** The last 30 days of signals matching the filter, newest day first, grouped by day. */
export function signalsByDay(
  signals: readonly Signal[],
  type: string,
  today: number,
): Map<number, Signal[]> {
  const kinds = SIGNAL_GROUPS[type];
  const cutoff = today - 30;
  const list = signals
    .filter((e) => e.day >= cutoff && (!kinds || kinds.includes(e.type)))
    .sort((a, b) => b.day - a.day);
  const byDay = new Map<number, Signal[]>();
  for (const e of list) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day)!.push(e);
  }
  return byDay;
}
/** New cards from the last 10 days, newest first, one per card. */
export function recentSpoilers(signals: readonly Signal[], today: number): Signal[] {
  const seen = new Set<string>(),
    items: Signal[] = [];
  for (const e of signals
    .filter((x) => x.type === "new_card" && x.day >= today - 10)
    .sort((a, b) => b.day - a.day)) {
    const k = e.k || e.n;
    if (seen.has(k)) continue;
    seen.add(k);
    items.push(e);
  }
  return items;
}
