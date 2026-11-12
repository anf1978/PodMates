// Public export lifecycle; the caller provides the current chart, not a feature/global dependency.
import "./export.css";
import { render } from "../../ui/html";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import { setStatusText } from "../../ui/status";
import { reportError } from "../../services/report-error";
import { buildExportText, type ExportDeck } from "./state";
import { exportTemplate } from "./view";

export function showExportDeck(deck: ExportDeck): void {
  const text = buildExportText(deck);
  const { modal } = openTadOverlay();
  render(
    exportTemplate(text, closeTryADeckModal, async () => {
      const status = modal.querySelector("#exportCopyStatus");
      try {
        await navigator.clipboard.writeText(text);
        if (status) status.textContent = "Copied.";
      } catch (error) {
        reportError(error, { operation: "deck-export" });
        if (status)
          status.textContent =
            "Could not copy automatically -- select the text above and copy it manually.";
      }
    }),
    modal,
  );
}

export function mount(button: HTMLElement, current: () => ExportDeck | null): () => void {
  const open = () => {
    const deck = current();
    if (deck) showExportDeck(deck);
    else
      setStatusText(
        document.getElementById("deckMgmtStatus"),
        "Chart a deck first, then export it.",
        true,
      );
  };
  button.addEventListener("click", open);
  return () => {
    button.removeEventListener("click", open);
  };
}
