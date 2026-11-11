// Existing Ledger CSV schema and UTF-8 download, including sale accounting.
import { showToast } from "../../ui/toast";
import { lotMetrics, TAGS, type Lot } from "./state";

function cell(value: unknown): string {
  const text = String(value == null ? "" : value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function tradesCsv(lots: readonly Lot[]): string {
  const head = [
    "card",
    "type",
    "version",
    "qty",
    "buy_price_each_yen",
    "extra_cost_yen",
    "bought_on",
    "shop",
    "reason",
    "note",
    "sold_qty",
    "last_sale_on",
    "realised_profit_yen",
    "open_qty",
  ];
  const rows = lots.map((l) => {
    const m = lotMetrics(l, null);
    return [
      l.card,
      l.paper ? "paper" : "real",
      l.finish || "",
      l.qty,
      l.buyYen,
      l.buyExtraYen || 0,
      l.buyDate,
      l.shop || "",
      TAGS[l.tag || ""],
      l.note || "",
      m.sold,
      m.lastSell || "",
      Math.round(m.realized),
      m.openQty,
    ];
  });
  return [head, ...rows].map((row) => row.map(cell).join(",")).join("\n") + "\n";
}

export function exportTrades(lots: readonly Lot[] | null): void {
  if (!lots?.length) {
    showToast("Nothing to export yet.");
    return;
  }
  const blob = new Blob(["\uFEFF" + tradesCsv(lots)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "pricescry-trades-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
