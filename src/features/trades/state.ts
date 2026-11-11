// Pure lot accounting and form transitions; Firestore field names stay unchanged.
import { PM_LIMITS as L } from "../../services/cloud/limits";
import type { TradeDoc, TradeSale, WithId } from "../../services/cloud/types";

export type Lot = WithId<TradeDoc>;
// Mercari defaults; keep in step with japanCostModel in pipelines/lib/pricescry-lib.mjs.
export const COSTS = { feePct: 10, shipYen: 230, packYen: 30 };
export const TAGS = { riser: "Riser pick", spoiler: "Spoiler play", other: "Other", "": "No tag" };

export interface TradeOptions {
  lot?: Lot;
  card?: string;
  paper?: boolean;
  qty?: number;
  yen?: number | null;
  tag?: TradeDoc["tag"];
  finish?: TradeDoc["finish"];
}

export interface Purchase {
  card: string;
  paper: boolean;
  qty: number;
  yen: number | "";
  extra: number;
  date: string;
  shop: string;
  tag: TradeDoc["tag"];
  note: string;
  finish: TradeDoc["finish"];
}

export function purchaseValues(opts: TradeOptions, today: string): Purchase {
  const lot = opts.lot;
  return lot
    ? {
        card: lot.card,
        paper: lot.paper,
        qty: lot.qty,
        yen: lot.buyYen,
        extra: lot.buyExtraYen || 0,
        date: lot.buyDate,
        shop: lot.shop || "",
        tag: lot.tag || "",
        note: lot.note || "",
        finish: lot.finish || "",
      }
    : {
        card: opts.card || "",
        paper: !!opts.paper,
        qty: opts.qty || 1,
        yen: opts.yen != null ? Math.round(opts.yen) : "",
        extra: 0,
        date: today,
        shop: "",
        tag: opts.tag || "",
        note: "",
        finish: opts.finish || "",
      };
}

export function toInt(value: unknown): number {
  const n = Number(String(value == null ? "" : value).replace(/[,\s¥]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date).getTime());
}

export function purchaseError(v: Purchase, sold: number): string | null {
  if (!v.card) return "Pick a card.";
  if (!(v.qty >= 1 && v.qty <= L.tradeQtyMax))
    return `How many: a whole number from 1 to ${L.tradeQtyMax}.`;
  if (v.qty < sold)
    return `${sold} of these are already recorded as sold, so "how many" can't be less than ${sold}.`;
  if (!(typeof v.yen === "number" && v.yen > 0 && v.yen <= L.tradeYenMax))
    return "Price each: a whole number of yen above zero.";
  if (!(v.extra >= 0 && v.extra <= L.tradeYenMax)) return "Extra cost: zero or more yen.";
  if (!validDate(v.date)) return "Date: use the form 2026-10-09.";
  return null;
}

export function markError(yen: number | null, date: string): string | null {
  if (yen != null && !(yen > 0 && yen <= L.tradeYenMax))
    return "Price: a whole number of yen above zero, or leave empty.";
  if (yen != null && !validDate(date)) return "Date: use the form 2026-10-09.";
  return null;
}

export function saleError(
  s: TradeSale,
  maxQty: number,
  saleCount: number,
  editing: boolean,
): string | null {
  if (!(s.qty >= 1 && s.qty <= maxQty)) return `How many sold: 1 to ${maxQty}.`;
  if (!(s.yen > 0 && s.yen <= L.tradeYenMax))
    return "Sale price: a whole number of yen above zero.";
  if (!(s.feePct >= 0 && s.feePct <= 30)) return "Fee: a percentage from 0 to 30.";
  if (!(s.shipYen >= 0 && s.packYen >= 0)) return "Shipping and packing: zero or more yen.";
  if (!validDate(s.date)) return "Date: use the form 2026-10-09.";
  if (!editing && saleCount >= L.tradeSells)
    return "That position already has the maximum number of sales recorded.";
  return null;
}

export function withSale(lot: Lot, sale: TradeSale, editIdx?: number): Lot {
  return {
    ...lot,
    sells:
      editIdx != null && lot.sells?.[editIdx]
        ? lot.sells.map((s, i) => (i === editIdx ? sale : s))
        : [...(lot.sells || []), sale],
  };
}

export function sellNet(s: Pick<TradeSale, "qty" | "yen"> & Partial<TradeSale>): number {
  const gross = s.qty * s.yen;
  const fee = Math.floor((gross * (s.feePct ?? COSTS.feePct)) / 100);
  return gross - fee - (s.shipYen ?? COSTS.shipYen) - (s.packYen ?? COSTS.packYen);
}

export function lotMetrics(lot: TradeDoc, markYen: number | null) {
  const basisPer = lot.buyYen + (lot.buyExtraYen || 0) / lot.qty;
  const sells = lot.sells || [];
  const sold = sells.reduce((a, s) => a + s.qty, 0),
    openQty = lot.qty - sold;
  const realized = sells.reduce((a, s) => a + sellNet(s) - s.qty * basisPer, 0);
  let net: number | null = null,
    unreal: number | null = null;
  if (openQty > 0 && markYen != null) {
    net = sellNet({ qty: openQty, yen: markYen });
    unreal = net - openQty * basisPer;
  }
  const lastSell =
    sells
      .map((s) => s.date)
      .sort()
      .pop() || null;
  return {
    basisPer,
    sold,
    openQty,
    realized,
    soldCost: sold * basisPer,
    closed: openQty === 0 && sold > 0,
    net,
    unreal,
    openCost: openQty * basisPer,
    lastSell,
    days: lastSell
      ? Math.max(
          0,
          Math.round((new Date(lastSell).getTime() - new Date(lot.buyDate).getTime()) / 86400000),
        )
      : null,
  };
}

export function signedYen(v: number): string {
  return (v > 0 ? "+" : v < 0 ? "−" : "") + "¥" + Math.abs(Math.round(v)).toLocaleString("en-US");
}
