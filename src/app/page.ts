// Start-up work that the inline page script used to do while the document parsed, kept ahead of
// every feature module: the card-database boot and its stall watchdog, the deck form, the mode
// tabs and the icon tooltips.
import { mount as mountDeckForm } from "../features/deck-form";
import { onDatasetProgress } from "../data/load-dataset";
import { datasetProgress, startBootWatchdog } from "../services/boot-status";
import { bootCardData } from "../services/card-data";
import { setupIconTooltips } from "../ui/tooltip";
import { mountModeTabs } from "./mode";

startBootWatchdog();
onDatasetProgress(datasetProgress);
void bootCardData(() => {
  (document.getElementById("chartBtn") as HTMLButtonElement).disabled = false;
});
mountDeckForm();
mountModeTabs();
document.addEventListener("DOMContentLoaded", () => setupIconTooltips(document));
