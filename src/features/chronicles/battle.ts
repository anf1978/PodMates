// Chronicle battle controls; comparison analysis and Gathering navigation cross explicit ports.
import * as cloud from "../../services/cloud/gatherings";
import { reportError } from "../../services/report-error";
import { render } from "../../ui/html";
import { showToast } from "../../ui/toast";
import { battleTemplate } from "./battle-view";
import { watchBattleResults } from "./watch";
import type { ChronicleBattle, ChronicleBattleDeck } from "./state";

export interface BattleRuntime {
  context: () => ChronicleBattle | null;
  setContext: (context: ChronicleBattle | null) => void;
  clearDecks: () => void;
  ready: () => boolean;
  analyze: (list: string, player: string, commander: string) => ChronicleBattleDeck | null;
  colors: readonly string[];
  results: (decks: ChronicleBattleDeck[]) => void;
  openGathering: (podId: string, gatheringId: string) => void;
  confirmAction: (message: string, label: string, action: () => Promise<void>) => void;
}

let runtime: BattleRuntime;
let feedback: (podId: string, id: string) => void;
let log: () => Promise<void>;
let stopWatching: (() => void) | undefined;

export function configureBattle(
  value: BattleRuntime,
  survey: typeof feedback,
  logBattle: typeof log,
): void {
  stopResultsPolling();
  runtime = value;
  feedback = survey;
  log = logBattle;
}

export function stopResultsPolling(): void {
  stopWatching?.();
  stopWatching = undefined;
}

export function startResultsPolling(): void {
  stopResultsPolling();
  const context = runtime.context();
  if (!context) return;
  stopWatching = watchBattleResults(
    context,
    () => runtime.context() === context,
    (id) => {
      context.loggedChronicleId = id;
      renderBattleControls();
      if (!context.isHost) feedback(context.podId, id);
    },
  );
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function renderBattleControls(): void {
  const area = document.getElementById("battleControlsArea");
  if (!area) return;
  render(
    battleTemplate(runtime.context(), {
      log: () =>
        runtime.confirmAction(
          "End the current battle and log it to your pod’s Chronicles? This can’t be undone.",
          "Log Battle",
          log,
        ),
      repeat: runRepeatBattle,
      startNew: runStartNewBattle,
      end: () => {
        const context = runtime.context();
        if (!context) return;
        runtime.confirmAction(
          "End this Gathering? Everyone still seated will see it’s over next time they check -- this doesn’t delete anything, it just closes it out.",
          "End Gathering",
          async () => {
            try {
              await cloud.endGathering(context.podId, context.gatheringId);
              if (runtime.context() === context) {
                runtime.setContext(null);
                stopResultsPolling();
                renderBattleControls();
              }
              showToast("Gathering ended.");
            } catch (error) {
              reportError(error, { operation: "cloud", userTriggered: true });
              showToast("Could not end the Gathering: " + message(error));
            }
          },
        );
      },
    }),
    area,
  );
}

async function runRepeatBattle(): Promise<void> {
  const context = runtime.context();
  if (!context || !runtime.ready()) return;
  let gathering;
  try {
    gathering = await cloud.loadGathering(context.podId, context.gatheringId);
  } catch (error) {
    reportError(error, { operation: "cloud", userTriggered: true });
    showToast("Could not repeat the battle: " + message(error));
    return;
  }
  if (runtime.context() !== context) return;
  if (!gathering) {
    showToast("This Gathering could not be found.");
    return;
  }
  const decks: ChronicleBattleDeck[] = [];
  for (const key of ["0", "1", "2", "3", "4", "5"]) {
    const seat = gathering.seats?.[key];
    if (!seat?.uid || !seat.deck?.list) continue;
    const result = runtime.analyze(
      seat.deck.list,
      seat.displayName || "",
      typeof seat.deck.commander === "string" ? seat.deck.commander : "",
    );
    if (result) {
      result.uid = seat.guest ? null : seat.uid;
      result.color = runtime.colors[decks.length % runtime.colors.length];
      decks.push(result);
    }
  }
  if (decks.length < 2) {
    showToast("Not enough decks loaded to repeat this battle.");
    return;
  }
  try {
    await cloud.markGatheringCharted(context.podId, context.gatheringId);
  } catch (error) {
    reportError(error, { operation: "cloud" });
  }
  if (runtime.context() !== context) return;
  context.ignoreChronicleId = gathering.lastLoggedChronicleId || context.loggedChronicleId || null;
  context.loggedChronicleId = null;
  runtime.results(decks);
  renderBattleControls();
  startResultsPolling();
}

async function runStartNewBattle(): Promise<void> {
  const context = runtime.context();
  if (!context) return;
  try {
    await cloud.resetGatheringDecks(context.podId, context.gatheringId);
  } catch (error) {
    reportError(error, { operation: "cloud", userTriggered: true });
    showToast("Could not start a new battle: " + message(error));
    return;
  }
  if (runtime.context() !== context) return;
  stopResultsPolling();
  runtime.setContext(null);
  runtime.clearDecks();
  renderBattleControls();
  const results = document.getElementById("podResultsSection");
  if (results) results.style.display = "none";
  runtime.openGathering(context.podId, context.gatheringId);
}
