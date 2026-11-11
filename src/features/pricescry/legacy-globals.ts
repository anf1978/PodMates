// Adapter: supplies PriceScry's ports from the Ledger/Spoiler Bait shims and the still-inline card picker and card
// DB. Publishes nothing on window; profile opens PriceScry and Trades switches its tab through typed events.
import { configurePriceScry, mount, type PriceScryPorts } from "./index";
import { findPageCard, pageCardSource } from "../../cards/legacy-globals";
import { wireCardSearch } from "../../ui/card-search";

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

configurePriceScry({
  // TODO(p3-6): the Ledger and Spoiler Bait shims remain until their typed owners expose mounts.
  renderLedger: (host) => psRenderLedger(host),
  renderBait: (host, options) => sbMount(host, { mode: "ps", ...options, podId: currentPodViewId }),
  wireSearch: (options) => wireCardSearch({ ...options, source: pageCardSource }),
  findCard: (name) => findPageCard(name) ?? null,
});
mount();
