// Temporary port for PriceScry's Ledger tab; pricing comes from the shared price-data service.
import { mount, type LedgerView } from "./index";
import { ledgerSnapshot } from "../../services/trade-ledger";
import { emit } from "../../services/events";
import { currentYen } from "../../services/price-data";
let current: LedgerView | null = null;
const legacy = {
  // TODO(p3-6): the trade adapter/browser flow still reads the existing lot snapshot name.
  psLedger: ledgerSnapshot,
  // TODO(p3-6): the PriceScry adapter still mounts its Ledger tab through this name.
  psRenderLedger: (body: HTMLElement): Promise<void> => {
    current?.destroy();
    current = mount(body, {
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
    return current.ready;
  },
};
type LedgerLegacy = typeof legacy;
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends LedgerLegacy {}
}
Object.assign(window, legacy);
