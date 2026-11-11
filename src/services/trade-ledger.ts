// Shared lot accounting and current ledger snapshot, consumed by Ledger and trade dialogs.
import type { TradeDoc, TradeSale, WithId } from "./cloud/types";
export type Lot = WithId<TradeDoc>;
export const COSTS = { feePct: 10, shipYen: 230, packYen: 30 };
export const TAGS = { riser: "Riser pick", spoiler: "Spoiler play", other: "Other", "": "No tag" };
export const ledgerSnapshot: { lots: Lot[] | null; marks: Record<string, number | null> } = {
  lots: null,
  marks: {},
};

export function sellNet(s: Pick<TradeSale, "qty" | "yen"> & Partial<TradeSale>): number {
  const gross = s.qty * s.yen;
  const fee = Math.floor((gross * (s.feePct ?? COSTS.feePct)) / 100);
  return gross - fee - (s.shipYen ?? COSTS.shipYen) - (s.packYen ?? COSTS.packYen);
}
export function lotMetrics(lot: TradeDoc, markYen: number | null) {
  const basisPer = lot.buyYen + (lot.buyExtraYen || 0) / lot.qty,
    sells = lot.sells || [];
  const sold = sells.reduce((sum, s) => sum + s.qty, 0),
    openQty = lot.qty - sold;
  const realized = sells.reduce((sum, s) => sum + sellNet(s) - s.qty * basisPer, 0);
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
export function signedYen(v: number | null): string {
  return v == null
    ? "—"
    : (v > 0 ? "+" : v < 0 ? "−" : "") + "¥" + Math.abs(Math.round(v)).toLocaleString("en-US");
}
