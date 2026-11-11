// Pure ledger filters and aggregate statistics, including incomplete price coverage.
import { lotMetrics, type Lot } from "../../services/trade-ledger";
export type Filter = "all" | "real" | "paper";
export const FILTERS: readonly [Filter, string][] = [
  ["all", "All"],
  ["real", "Real"],
  ["paper", "Paper"],
];
export const FINISH_NAMES = { "": "", nonfoil: "non-foil", foil: "foil", etched: "etched foil" };
export function shownLots(lots: readonly Lot[], filter: Filter): Lot[] {
  return lots.filter((lot) => filter === "all" || (filter === "paper") === !!lot.paper);
}
export function ledgerStats(lots: readonly Lot[], marks: Record<string, number | null> = {}) {
  const rows = lots.map((lot) => ({ lot, m: lotMetrics(lot, marks[lot.id] ?? null) }));
  const closed = rows.filter((r) => r.m.closed),
    open = rows.filter((r) => r.m.openQty > 0);
  const wins = closed.filter((r) => r.m.realized > 0),
    losses = closed.filter((r) => r.m.realized <= 0);
  const mean = (a: number[]): number | null =>
    a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const costClosed = closed.reduce((sum, r) => sum + r.m.soldCost, 0);
  const marked = open.filter((r) => r.m.net != null);
  return {
    closedN: closed.length,
    wins: wins.length,
    winRate: closed.length ? wins.length / closed.length : null,
    avgWin: mean(wins.map((r) => r.m.realized)),
    avgLoss: losses.length ? -mean(losses.map((r) => r.m.realized))! : null,
    expectancyYen: mean(closed.map((r) => r.m.realized)),
    expectancyPct: costClosed
      ? closed.reduce((sum, r) => sum + r.m.realized, 0) / costClosed
      : null,
    totalRealized: rows.reduce((sum, r) => sum + r.m.realized, 0),
    avgDays: mean(closed.map((r) => r.m.days).filter((d): d is number => d != null)),
    openN: open.length,
    openCost: open.reduce((sum, r) => sum + r.m.openCost, 0),
    openNet: marked.length ? marked.reduce((sum, r) => sum + r.m.net!, 0) : null,
    unrealized: marked.length ? marked.reduce((sum, r) => sum + r.m.unreal!, 0) : null,
    unmarked: open.length - marked.length,
    rows,
  };
}
export type Stats = ReturnType<typeof ledgerStats>;
export const pct = (v: number | null): string =>
  v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + "%";
