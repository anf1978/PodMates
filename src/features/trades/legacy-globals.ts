// Temporary ports to unmoved PriceScry and Ledger; never accesses the cloud shim.
import {
  mount,
  openTradeForm,
  openMarkForm,
  openSellForm,
  confirmRemoveSale,
  confirmDeleteLot,
} from "./index";
import { exportTrades } from "./csv";
import { lotMetrics, toInt, TAGS, type Lot } from "./state";
import type { TradesPorts } from "./runtime";

declare const psLedger: { lots: Lot[] | null; marks: Record<string, number | null> };
declare const psCurrentYen: TradesPorts["currentYen"];
declare const pricescryNameKey: TradesPorts["nameKey"];
declare const pmWireCardSearch: TradesPorts["wireSearch"];
declare function psSetTab(tab: string): void;

mount({
  lots: () => psLedger.lots || [],
  mark: (id) => psLedger.marks[id],
  currentYen: (card) => psCurrentYen(card),
  nameKey: (card) => pricescryNameKey(card),
  wireSearch: (options) => pmWireCardSearch(options),
  refresh: () => psSetTab("ledger"),
});

const legacy = {
  // TODO(p3-6): card detail, planner and Ledger still open purchase dialogs.
  psOpenTradeForm: openTradeForm,
  // TODO(p3-6): Ledger still opens its price-check action.
  psOpenMarkForm: openMarkForm,
  // TODO(p3-6): Ledger still opens sale/edit actions.
  psOpenSellForm: openSellForm,
  // TODO(p3-6): Ledger still owns sale removal buttons.
  psConfirmRemoveSale: confirmRemoveSale,
  // TODO(p3-6): Ledger still owns lot deletion buttons.
  psConfirmDeleteLot: confirmDeleteLot,
  // TODO(p3-6): Ledger still owns its CSV export button.
  psExportTrades: exportTrades,
  // TODO(p3-6): Ledger stats still use lot accounting.
  psLotMetrics: lotMetrics,
  // TODO(p3-6): the inline planner still parses yen inputs.
  psToInt: toInt,
  // TODO(p3-6): Ledger rows and reason statistics still use these labels.
  PS_TAGS: TAGS,
};
type TradesLegacy = typeof legacy;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends TradesLegacy {}
}
Object.assign(window, legacy);
