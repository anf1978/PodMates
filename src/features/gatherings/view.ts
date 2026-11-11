// Gathering overlay lifecycle, live seats and handoff to the legacy chart.
import { html, render, nothing, type TemplateResult } from "../../ui/html";
import { openTadOverlay, closeTryADeckModal } from "../../ui/tad-modal";
import { showToast } from "../../ui/toast";
import { getCurrentUser } from "../../services/cloud/session";
import {
  loadGathering,
  endGathering,
  markGatheringCharted,
  type Gathering,
} from "../../services/cloud/gatherings";
import { reportError } from "../../services/report-error";
import { occupied } from "./state";
import { errorMessage } from "./controls";
import { gatheringRuntime, type ChartDeck, type BattleContext } from "./runtime";
import { availableMembers, seatViews, type TrayActions } from "./tray";
import { renderWaitingTray } from "./waiting";
import { watchTray } from "./watch";

let stopWatch: (() => void) | undefined;
let generation = 0;
const seenCharted = new Map<string, number>();

export function stopGatheringPolling(): void {
  stopWatch?.();
  stopWatch = undefined;
}

export function endGatheringConfirmation(battle: boolean): TemplateResult {
  return html`<p class="g-confirm-text">
      ${
        battle
          ? html`<strong
                >Ending this Gathering will stop the current battle from being logged</strong
              >, so it won't be recorded or rated. To keep it, go back and tap
              <strong>Log Battle</strong> first.<br /><br />End the Gathering anyway?`
          : html`End this Gathering? Everyone still seated will see it's over next time they check,
            and it'll move out of "live" -- this doesn't delete anything, it just closes it out.`
      }
    </p>
    <div class="row g-confirm-actions">
      <button id="endGatheringCancelBtn" class=${battle ? "g-gold-border" : "ghost"}>
        ${battle ? "Go back" : "Cancel"}
      </button>
      <button id="endGatheringConfirmBtn" class="ghost g-danger-button">
        ${battle ? "End anyway" : "End Gathering"}
      </button>
    </div>`;
}

function chartDecks(g: Gathering): ChartDeck[] {
  const runtime = gatheringRuntime();
  const decks: ChartDeck[] = [];
  for (const { s } of occupied(g)) {
    if (!s.deck?.list) continue;
    const result = runtime.analyze(
      s.deck.list,
      s.displayName || "",
      String(s.deck.commander || ""),
    );
    if (result) {
      result.uid = s.guest ? null : s.uid;
      result.color = runtime.colors[decks.length % runtime.colors.length];
      decks.push(result);
    }
  }
  return decks;
}

function showChart(podId: string, g: Gathering, decks: ChartDeck[], clicked: boolean): void {
  stopGatheringPolling();
  closeTryADeckModal();
  const user = getCurrentUser();
  const context: BattleContext = {
    podId,
    gatheringId: g.id,
    gatheringTitle: g.title || "",
    ignoreChronicleId: g.lastLoggedChronicleId || null,
    isHost: clicked || g.hostUid === user?.uid,
    hostName: clicked
      ? user?.displayName || "the host"
      : occupied(g).find((r) => r.s.uid === g.hostUid)?.s.displayName || "the host",
    participants: occupied(g)
      .filter((r) => !r.s.guest)
      .map((r) => ({
        uid: r.s.uid,
        displayName: r.s.displayName || "Podmate",
      })),
  };
  gatheringRuntime().results(decks, context);
}

export function openGatheringSeatDeckPicker(
  podId: string,
  id: string,
  k: string,
  g: Gathering,
): void {
  const seat = g.seats[k];
  gatheringRuntime().pickDeck({
    gatheringSeat: {
      podId,
      gatheringId: id,
      seatIndex: Number(k),
      seatUid: seat.uid,
      seatIsGuest: !!seat.guest,
      seatDisplayName: seat.displayName || "Podmate",
    },
  });
}

export async function openLiveGatheringOverlay(podId: string, id: string): Promise<void> {
  stopGatheringPolling();
  const close = (): void => {
    generation++;
    stopGatheringPolling();
    closeTryADeckModal();
  };
  const { modal } = openTadOverlay({ onDismiss: close });
  render(
    html`<button class="tad-close" id="tadCloseBtn" @click=${close}>Close ×</button>
      <div id="gatheringTrayContent"><p class="g-loading">Loading…</p></div>`,
    modal,
  );
  const content = modal.querySelector<HTMLElement>("#gatheringTrayContent")!;
  await renderLiveGatheringTray(podId, id);
  if (!content.isConnected) return;
  stopWatch = watchTray(podId, id, content, (g) => {
    void renderLiveGatheringTray(podId, id, g);
  });
}

export async function renderLiveGatheringTray(
  podId: string,
  id: string,
  preloaded?: Gathering | null,
): Promise<void> {
  const content = document.getElementById("gatheringTrayContent");
  if (!content) return;
  const ticket = ++generation;
  const current = (): boolean => content.isConnected && generation === ticket;
  delete content.dataset.confirming;
  let g: Gathering | null;
  try {
    g = preloaded === undefined ? await loadGathering(podId, id) : preloaded;
  } catch (error) {
    reportError(error, { operation: "gatherings" });
    if (current())
      render(
        html`<p class="g-error">${"Could not load this Gathering: " + errorMessage(error)}</p>`,
        content,
      );
    return;
  }
  if (!current()) return;
  if (!g) {
    render(
      html`<p class="g-error">This Gathering couldn't be found — it may have ended.</p>`,
      content,
    );
    return;
  }
  if (g.status === "ended" || g.status === "cancelled") {
    stopGatheringPolling();
    render(
      html`<p class="g-ended">
        ${g.status === "ended" ? "This Gathering has ended. Thanks for joining!" : "This gathering was cancelled by the host."}
      </p>`,
      content,
    );
    return;
  }
  const gathering = g;
  const actions: TrayActions = {
    open: () => openLiveGatheringOverlay(podId, id),
    refresh: () => renderLiveGatheringTray(podId, id),
    stop: stopGatheringPolling,
    pick: (k, g) => openGatheringSeatDeckPicker(podId, id, k, g),
  };
  if (g.status === "proposed") {
    await renderWaitingTray(content, podId, g, actions, current);
    return;
  }
  if (g.chartedAt && g.chartedAt !== seenCharted.get(id)) {
    seenCharted.set(id, g.chartedAt);
    if (gatheringRuntime().ready()) {
      const decks = chartDecks(g);
      if (decks.length >= 2) {
        showChart(podId, g, decks, false);
        return;
      }
    }
  }
  const isHost = g.hostUid === getCurrentUser()?.uid;
  const seated = occupied(g);
  const host = seated.find((r) => r.s.uid === gathering.hostUid)?.s.displayName || "the host";
  const members = await availableMembers(podId, g, isHost);
  if (!current()) return;
  const chart = async (e: Event): Promise<void> => {
    if (!gatheringRuntime().ready()) {
      showToast("Card database still loading — try again in a moment.");
      return;
    }
    const decks = chartDecks(gathering);
    if (decks.length < 2) {
      showToast("At least 2 seats need a deck loaded before charting the battle.");
      return;
    }
    const button = e.currentTarget as HTMLButtonElement;
    button.disabled = true;
    button.textContent = "Charting…";
    try {
      await markGatheringCharted(podId, id);
    } catch (error) {
      reportError(error, { operation: "gatherings", userTriggered: true });
    }
    showChart(podId, gathering, decks, true);
  };
  const end = (): void => {
    generation++;
    content.dataset.confirming = "1";
    render(endGatheringConfirmation(seated.some((r) => r.s.deck)), content);
    content.querySelector("#endGatheringCancelBtn")!.addEventListener("click", () => {
      void actions.refresh();
    });
    content.querySelector("#endGatheringConfirmBtn")!.addEventListener("click", () => {
      void (async () => {
        try {
          await endGathering(podId, id);
          stopGatheringPolling();
          closeTryADeckModal();
          gatheringRuntime().refreshPods();
          showToast("Gathering ended.");
        } catch (error) {
          showToast("Could not end the Gathering: " + errorMessage(error));
          await actions.refresh();
        }
      })();
    });
  };
  render(
    html` <h2 class="g-mb4">${g.title}</h2>
      <p class="g-live-subtitle">${`Live Gathering — hosted by ${host}`}</p>
      ${isHost ? html`<button id="endGatheringBtn" class="ghost g-full g-mb16 g-danger-button g-f125" @click=${end}>End Gathering</button>` : nothing}
      <div id="gatheringSeatsArea">${seatViews(podId, g, members, isHost, actions)}</div>
      ${
        isHost
          ? html`<button id="chartBattleBtn" class="g-full g-mt8" @click=${chart}>
              Chart the Battle
            </button>`
          : html`<p class="g-waiting-message">
              ${`Waiting for ${host} to chart the battle once everyone's picked a deck.`}
            </p>`
      }
      <button id="gatheringRefreshBtn" class="ghost g-full g-mt6 g-f125" @click=${actions.refresh}>
        Refresh
      </button>`,
    content,
  );
}

export async function runSampleGathering(): Promise<void> {
  const runtime = gatheringRuntime();
  if (!runtime.ready()) {
    showToast("Card database still loading — try again in a moment.");
    return;
  }
  const { modal } = openTadOverlay({ modalId: "tadModal" });
  render(
    html`<button class="tad-close" id="tadCloseBtn" @click=${closeTryADeckModal}>Close ×</button>
      <h2>Sample table</h2>
      <p class="g-loading">Loading...</p>`,
    modal,
  );
  let pool: Awaited<ReturnType<typeof runtime.library>>[number][];
  try {
    pool = [...(await runtime.library())];
  } catch (error) {
    reportError(error, { operation: "gatherings" });
    if (modal.isConnected)
      modal.querySelector("p")!.textContent =
        "Could not load the sample table: " + errorMessage(error);
    return;
  }
  if (!modal.isConnected) return;
  const decks: ChartDeck[] = [];
  for (let count = 0; count < 6 && pool.length; count++) {
    const [pick] = pool.splice(Math.floor(Math.random() * pool.length), 1);
    const result = runtime.analyze(pick.decklist, pick.flavorName, pick.commander);
    if (result) {
      result.color = runtime.colors[decks.length % runtime.colors.length];
      decks.push(result);
    }
  }
  if (decks.length < 2) {
    showToast("Could not build a sample table right now — try again.");
    return;
  }
  closeTryADeckModal();
  runtime.results(decks, null);
}
