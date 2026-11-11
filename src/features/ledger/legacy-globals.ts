// Temporary PriceScry ports; R13 replaces the inline tab/pricing/navigation callers.
import { mount, type LedgerPorts, type LedgerView } from "./index";
import { ledgerSnapshot } from "../../services/trade-ledger";
declare const psCurrentYen: LedgerPorts["currentYen"];
declare const psState: { rec: unknown };
declare const psOpenTradeForm: (options: {
  lot?: Parameters<LedgerPorts["actions"]["edit"]>[0];
}) => void;
declare const psOpenMarkForm: LedgerPorts["actions"]["mark"];
declare const psOpenSellForm: LedgerPorts["actions"]["sell"];
declare const psConfirmRemoveSale: LedgerPorts["actions"]["removeSale"];
declare const psConfirmDeleteLot: LedgerPorts["actions"]["removeLot"];
declare const psExportTrades: LedgerPorts["actions"]["export"];
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
        add: () => psOpenTradeForm({}),
        edit: (lot) => psOpenTradeForm({ lot }),
        mark: (id) => psOpenMarkForm(id),
        sell: (id, index) => psOpenSellForm(id, index),
        removeSale: (id, index) => psConfirmRemoveSale(id, index),
        removeLot: (id) => psConfirmDeleteLot(id),
        export: (lots) => psExportTrades(lots),
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
