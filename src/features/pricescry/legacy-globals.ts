// Adapter: supplies PriceScry's ports from the Ledger/Spoiler Bait shims and the still-inline card picker and card
// DB. Publishes nothing on window; profile opens PriceScry and Trades switches its tab through typed events.
import { configurePriceScry, mount, type PriceScryPorts } from "./index";

declare const psRenderLedger: (host: HTMLElement) => Promise<void>;
type BaitOptions = Parameters<PriceScryPorts["renderBait"]>[1];
declare const sbMount: (
  host: HTMLElement,
  options: Omit<BaitOptions, "signals"> & {
    mode: "ps";
    podId: string | null;
    signals: readonly unknown[];
  },
) => Promise<void>;
declare const currentPodViewId: string | null;
declare const pmWireCardSearch: PriceScryPorts["wireSearch"];
declare const indexes: { byExactName?: Map<string, { g?: unknown; b?: unknown }> } | undefined;

configurePriceScry({
  // TODO(p3-6): the Ledger, Spoiler Bait and card-picker shims remain until their typed owners expose mounts.
  renderLedger: (host) => psRenderLedger(host),
  renderBait: (host, options) => sbMount(host, { mode: "ps", ...options, podId: currentPodViewId }),
  wireSearch: (options) => pmWireCardSearch(options),
  findCard: (name) =>
    typeof indexes !== "undefined" && indexes && indexes.byExactName
      ? indexes.byExactName.get(name)
      : null,
});
mount();
