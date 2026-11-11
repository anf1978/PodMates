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
import { toInt } from "./state";
import type { TradesPorts } from "./runtime";
import { ledgerSnapshot } from "../../services/trade-ledger";
import { on } from "../../services/events";

declare const psCurrentYen: TradesPorts["currentYen"];
declare const pricescryNameKey: TradesPorts["nameKey"];
declare const pmWireCardSearch: TradesPorts["wireSearch"];
declare function psSetTab(tab: string): void;

mount({
  lots: () => ledgerSnapshot.lots || [],
  mark: (id) => ledgerSnapshot.marks[id],
  currentYen: (card) => psCurrentYen(card),
  nameKey: (card) => pricescryNameKey(card),
  wireSearch: (options) => pmWireCardSearch(options),
  refresh: () => psSetTab("ledger"),
});

on("trades:purchase", openTradeForm);
on("trades:mark", openMarkForm);
on("trades:sell", ({ id, index }) => openSellForm(id, index));
on("trades:remove-sale", ({ id, index }) => confirmRemoveSale(id, index));
on("trades:remove-lot", confirmDeleteLot);
on("trades:export", exportTrades);

const legacy = {
  // TODO(p3-6): inline PriceScry card detail/planner still open purchase dialogs.
  psOpenTradeForm: openTradeForm,
  // TODO(p3-6): the existing offline browser flow still opens the price-check action.
  psOpenMarkForm: openMarkForm,
  // TODO(p3-6): the existing offline browser flow still opens the sale action.
  psOpenSellForm: openSellForm,
  // TODO(p3-6): the existing offline browser flow still opens the delete confirmation.
  psConfirmDeleteLot: confirmDeleteLot,
  // TODO(p3-6): the inline planner still parses yen inputs.
  psToInt: toInt,
};
type TradesLegacy = typeof legacy;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends TradesLegacy {}
}
Object.assign(window, legacy);
