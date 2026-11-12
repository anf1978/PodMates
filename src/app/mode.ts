// The Deck Chart / MyPods mode tabs. Switching shows each tab's results again if something was
// already computed there, keeps Gathering result polling to the visible tab, and refreshes MyPods
// every time it opens (membership, invites and live Gatherings change from outside the tab).
import { startResultsPolling, stopResultsPolling } from "../features/chronicles/battle";
import { currentChart } from "../services/current-chart";
import { emit } from "../services/events";
import { selectTab } from "../ui/tabs";
import { battleContext, podDecks } from "./battle";

export type Mode = "single" | "pod";

const MODES = {
  single: { container: "singleMode", btn: "modeSingleBtn" },
  pod: { container: "podMode", btn: "modePodBtn" },
} as const;

const byId = (id: string) => document.getElementById(id);

export function setMode(mode: Mode): void {
  // CSS owns both button states (.mode-btn.active / :not(.active)); this only moves the class.
  selectTab(
    (Object.keys(MODES) as Mode[]).map((key) => ({
      key,
      button: byId(MODES[key].btn),
      panel: byId(MODES[key].container),
    })),
    mode,
  );
  byId("resultsSection")!.style.display =
    mode === "single" && currentChart().hasResult ? "block" : "none";
  byId("podResultsSection")!.style.display = mode === "pod" && podDecks() ? "block" : "none";
  const context = battleContext();
  if (mode === "pod" && context && !context.loggedChronicleId) startResultsPolling();
  else stopResultsPolling();
  if (mode === "pod") emit("pods:refresh", undefined);
}

export function mountModeTabs(): void {
  byId("modeSingleBtn")!.addEventListener("click", () => setMode("single"));
  byId("modePodBtn")!.addEventListener("click", () => setMode("pod"));
}
