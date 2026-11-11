// Public PriceScry API. Only this file and the ports load with the page; the screen, password gate and views are a
// separate chunk fetched the first time someone opens PriceScry (see CLAUDE.md in this folder).
import "./pricescry.css";
import { on } from "../../services/events";
import { reportError } from "../../services/report-error";
export { configurePriceScry, type PriceScryPorts } from "./runtime";

/** Asks for the soft-gate password once per session, then opens the screen. */
export async function requestPriceScryAccess(): Promise<void> {
  const { requestAccess } = await import("./access");
  requestAccess();
}

let mounted = false;
export function mount(): void {
  if (mounted) return;
  mounted = true;
  on("pricescry:open", () => {
    requestPriceScryAccess().catch((error: unknown) =>
      reportError(error, { operation: "pricescry", userTriggered: true }),
    );
  });
  // A trade saved from a card page shows the Ledger tab, as before; nothing happens while the screen is closed.
  on("pricescry:tab", (tab) => {
    if (!document.getElementById("pricescryOverlay")) return;
    void import("./screen").then(({ setTab }) => setTab(tab));
  });
}
