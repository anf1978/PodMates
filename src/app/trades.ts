// Trades' ports (lots, prices, card search) and the typed trade events Ledger sends.
import {
  confirmDeleteLot,
  confirmRemoveSale,
  mount,
  openMarkForm,
  openSellForm,
  openTradeForm,
} from "../features/trades";
import { exportTrades } from "../features/trades/csv";
import { pageCardSource } from "../services/card-data";
import { emit, on } from "../services/events";
import { currentYen, nameKey } from "../services/price-data";
import { ledgerSnapshot } from "../services/trade-ledger";
import { wireCardSearch } from "../ui/card-search";

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
