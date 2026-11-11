// Supplies PriceScry's ports: its Ledger and Spoiler Bait tabs, and the shared card search.
import { mount as mountLedger, type LedgerView } from "../features/ledger";
import { configurePriceScry, mount } from "../features/pricescry";
import { mount as mountBait } from "../features/spoiler-bait";
import { findPageCard, pageCardSource } from "../services/card-data";
import { emit } from "../services/events";
import { currentYen } from "../services/price-data";
import { wireCardSearch } from "../ui/card-search";
import { activePodId } from "./active-pod";

let ledger: LedgerView | null = null;

function renderLedger(body: HTMLElement): Promise<void> {
  ledger?.destroy();
  ledger = mountLedger(body, {
    currentYen,
    actions: {
      add: () => emit("trades:purchase", {}),
      edit: (lot) => emit("trades:purchase", { lot }),
      mark: (id) => emit("trades:mark", id),
      sell: (id, index) => emit("trades:sell", { id, index }),
      removeSale: (id, index) => emit("trades:remove-sale", { id, index }),
      removeLot: (id) => emit("trades:remove-lot", id),
      export: (lots) => emit("trades:export", lots),
    },
  });
  return ledger.ready;
}

configurePriceScry({
  renderLedger,
  renderBait: (host, options) =>
    mountBait(host, { mode: "ps", ...options, podId: activePodId() }).ready,
  wireSearch: (options) => wireCardSearch({ ...options, source: pageCardSource }),
  findCard: (name) => findPageCard(name) ?? null,
});
mount();
