// Trades ports (price lookup, Ledger refresh, legacy card picker); never accesses the cloud shim.
import {
  mount,
  openTradeForm,
  openMarkForm,
  openSellForm,
  confirmRemoveSale,
  confirmDeleteLot,
} from "./index";
import { exportTrades } from "./csv";
import { ledgerSnapshot } from "../../services/trade-ledger";
import { emit, on } from "../../services/events";
import { currentYen, nameKey } from "../../services/price-data";
import { pageCardSource } from "../../cards/legacy-globals";
import { wireCardSearch } from "../../ui/card-search";

mount({
  lots: () => ledgerSnapshot.lots || [],
  mark: (id) => ledgerSnapshot.marks[id],
  currentYen,
  nameKey,
  wireSearch: (options) => wireCardSearch({ ...options, source: pageCardSource }),
  refresh: () => emit("pricescry:tab", "ledger"),
});

on("trades:purchase", openTradeForm);
on("trades:mark", openMarkForm);
on("trades:sell", ({ id, index }) => openSellForm(id, index));
on("trades:remove-sale", ({ id, index }) => confirmRemoveSale(id, index));
on("trades:remove-lot", confirmDeleteLot);
on("trades:export", exportTrades);

const legacy = {
  // TODO(p3-6): trades.spec opens a prefilled purchase dialog through this name (PriceScry uses trades:purchase).
  psOpenTradeForm: openTradeForm,
  // TODO(p3-6): the existing offline browser flow still opens the price-check action.
  psOpenMarkForm: openMarkForm,
  // TODO(p3-6): the existing offline browser flow still opens the sale action.
  psOpenSellForm: openSellForm,
  // TODO(p3-6): the existing offline browser flow still opens the delete confirmation.
  psConfirmDeleteLot: confirmDeleteLot,
};
type TradesLegacy = typeof legacy;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends TradesLegacy {}
}
Object.assign(window, legacy);
