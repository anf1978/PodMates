// Public Ledger lifecycle: repositories own persistence; callers supply PriceScry pricing/actions.
import "./ledger.css";
import { getCurrentUser } from "../../services/cloud/session";
import { loadTrades } from "../../services/cloud/trades";
import { ledgerSnapshot, lotMetrics } from "../../services/trade-ledger";
import { reportError } from "../../services/report-error";
import { render, nothing } from "../../ui/html";
import { ledgerStats, shownLots, type Filter } from "./state";
import { ledgerView, note, type Actions } from "./view";
export interface LedgerPorts {
  currentYen(card: string): Promise<number | null>;
  actions: Omit<Actions, "filter" | "export"> & {
    export(lots: ReturnType<typeof shownLots>): void;
  };
}
export interface LedgerView {
  ready: Promise<void>;
  destroy(): void;
}
let filter: Filter = "all";
export function mount(host: HTMLElement, ports: LedgerPorts): LedgerView {
  const root = document.createElement("div");
  root.className = "ledger-content";
  host.replaceChildren(root);
  let disposed = false,
    generation = 0;
  const uid = getCurrentUser()?.uid;
  const live = (version: number): boolean =>
    !disposed && root.isConnected && generation === version && getCurrentUser()?.uid === uid;
  async function load(): Promise<void> {
    const version = ++generation,
      user = getCurrentUser();
    if (!user || user.isAnonymous) {
      render(
        note(
          "Sign in to keep a trade ledger. It is saved to your account, so it follows you between devices.",
        ),
        root,
      );
      return;
    }
    render(note("Loading…"), root);
    try {
      const lots = await loadTrades();
      if (!live(version)) return;
      const shown = shownLots(lots, filter),
        refs: Record<string, number | null> = {},
        marks: Record<string, number | null> = {};
      await Promise.all(
        shown
          .filter((lot) => lotMetrics(lot, null).openQty > 0)
          .map(async (lot) => {
            refs[lot.id] = await ports.currentYen(lot.card);
            marks[lot.id] = lot.markYen != null ? lot.markYen : refs[lot.id];
          }),
      );
      if (!live(version)) return;
      ledgerSnapshot.lots = lots;
      ledgerSnapshot.marks = marks;
      render(
        ledgerView(ledgerStats(shown, marks), filter, refs, {
          ...ports.actions,
          filter(value) {
            filter = value;
            void load();
          },
          export: () => ports.actions.export(shown),
        }),
        root,
      );
    } catch (error) {
      reportError(error, { operation: "cloud" });
      if (live(version))
        render(
          note(
            `Couldn't load your ledger (${error instanceof Error ? error.message : String(error)}).`,
          ),
          root,
        );
    }
  }
  const view = {
    ready: load(),
    destroy() {
      disposed = true;
      generation++;
      render(nothing, root);
      root.remove();
    },
  };
  return view;
}
