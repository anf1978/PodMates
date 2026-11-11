// Temporary PriceScry ports; R13 replaces the inline tab/pricing/navigation callers.
import { mount, type LedgerPorts, type LedgerView } from "./index";
import { ledgerSnapshot } from "../../services/trade-ledger";
import { emit } from "../../services/events";
declare const psCurrentYen: LedgerPorts["currentYen"];
declare const psState: { rec: unknown };
let current: LedgerView | null = null;
const legacy = {
  // TODO(p3-6): the trade adapter/browser flow still reads the existing lot snapshot name.
  psLedger: ledgerSnapshot,
  // TODO(p3-6): PriceScry's inline tab switch still mounts its Ledger.
  psRenderLedger: (): Promise<void> => {
    const body = document.getElementById("psBody");
    if (!body) return Promise.resolve();
    current?.destroy();
    psState.rec = null;
    current = mount(body, {
      currentYen: (card) => psCurrentYen(card),
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
