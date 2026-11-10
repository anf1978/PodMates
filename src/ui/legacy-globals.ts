// Strangler shim: publishes the UI primitives on `window` for the inline legacy scripts
// in index.html. `window.pmUi` is the typed surface; the other names are exactly the
// functions those scripts already call. Add no behaviour here; delete it with the last caller.

import { cardNameLinkHtml } from "./card-name.ts";
import { closeAllModals, closeModal, openModal, openModals } from "./modal.ts";
import { MANA_COLOR_STYLE, manaSymbolHtml } from "./mana-symbol.ts";
import { ordinal } from "./format.ts";
import { radarChartSvg } from "./radar-chart.ts";
import { setStatusText } from "./status.ts";
import { selectTab, tabsByAttribute } from "./tabs.ts";
import { showToast } from "./toast.ts";
import { setupIconTooltips } from "./tooltip.ts";

const pmUi = Object.freeze({
  openModal,
  closeModal,
  openModals,
  closeAllModals,
  selectTab,
  tabsByAttribute,
  radarChartSvg,
});

declare global {
  interface Window {
    pmUi: typeof pmUi;
    showToast: (message: string) => void;
    setStatus: (message: string, isError?: unknown) => void;
    setDeckMgmtStatus: (message: string, isError?: unknown) => void;
    setupIconTooltipsFor: (scope?: ParentNode | null) => void;
    ordinalSuffix: typeof ordinal;
    // TODO(p3-6): drop once the profile, PriceScry and Deck Chart string builders are moved.
    MANA_COLOR_STYLE: typeof MANA_COLOR_STYLE;
    manaSymbol: typeof manaSymbolHtml;
    cardNameLink: typeof cardNameLinkHtml;
  }
}

window.pmUi = pmUi;
window.showToast = (message) => showToast(message);
window.setStatus = (message, isError) =>
  setStatusText(document.getElementById("status"), message, isError);
window.setDeckMgmtStatus = (message, isError) =>
  setStatusText(document.getElementById("deckMgmtStatus"), message, isError);
window.setupIconTooltipsFor = (scope) => setupIconTooltips(scope ?? document);
window.ordinalSuffix = ordinal;
window.MANA_COLOR_STYLE = MANA_COLOR_STYLE;
window.manaSymbol = manaSymbolHtml;
window.cardNameLink = cardNameLinkHtml;
