// Impact modal lifecycle and repository actions; never writes the chart's standard analysis.
import "./impact.css";
import { html, nothing, render } from "../../ui/html";
import { openTadOverlay, closeTryADeckModal } from "../../ui/tad-modal";
import { showToast } from "../../ui/toast";
import { getCurrentUser } from "../../services/cloud/session";
import * as cloud from "../../services/cloud/impact";
import { loadDataset } from "../../data/load-dataset";
import { reportError } from "../../services/report-error";
import { ImpactRepository } from "./repository";
import {
  canEdit,
  effectiveList,
  impactKey,
  isDefault,
  type Candidate,
  type ChartAnalysis,
} from "./state";
import { captionView, modalView, renderBody, renderPodView } from "./view";
import type { ImpactPorts } from "./runtime";

const repository = new ImpactRepository();
let ports: ImpactPorts;
let candidateData: Promise<readonly Candidate[]> | undefined;

export function mount(runtime: ImpactPorts): void {
  ports = runtime;
}

export function mountImpactChart(agg: Pick<ChartAnalysis["agg"], "deckCardNames">): void {
  const area = document.getElementById("impactChart");
  if (!area) return;
  render(
    captionView(agg, () => {
      void openImpactCardsModal();
    }),
    area,
  );
  void refreshPodView();
}

async function refreshPodView(): Promise<void> {
  const el = document.getElementById("podViewLine");
  if (!el) return;
  render(nothing, el);
  if (!ports.analysis() || !getCurrentUser()) return;
  try {
    if ((await repository.load()) && el.isConnected)
      renderPodView(el, repository.state, ports.analysis());
  } catch (error) {
    reportError(error, { operation: "cloud" });
  }
}

function message(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "permission-denied")
    return "Your pod\u2019s rules do not allow that yet. The Steward needs to publish the latest Firestore rules.";
  return error instanceof Error ? error.message : "Could not save that change.";
}

export async function openImpactCardsModal(): Promise<void> {
  const { modal } = openTadOverlay({ modalClass: "tad-modal impact-modal" });
  render(modalView(), modal);
  modal.querySelector("#tadCloseBtn")!.addEventListener("click", closeTryADeckModal);
  const body = modal.querySelector<HTMLElement>("#impactBody")!;
  let rows: readonly Candidate[];
  try {
    [rows] = await Promise.all([
      (candidateData ??= loadDataset<readonly Candidate[]>("IMPACT_CANDS")),
      ports.loadLibrary(),
    ]);
  } catch (error) {
    reportError(error, { operation: "deck-library" });
    if (body.isConnected)
      body.textContent = `Could not load impact cards: ${error instanceof Error ? error.message : String(error)}`;
    return;
  }
  if (!body.isConnected) return;
  modal.classList.add("impact-modal-loaded");
  repository.syncAccount();
  repository.state.openReasonKey = null;
  repository.state.busy = false;
  try {
    if (getCurrentUser()) await repository.load(null, true);
  } catch (error) {
    reportError(error, { operation: "cloud" });
  }
  if (!body.isConnected) return;
  body.replaceChildren();

  const redraw = (): void => {
    if (body.isConnected)
      renderBody(body, repository.state, rows, getCurrentUser()?.uid || null, ports.analysis());
  };
  async function write(action: (podId: string) => Promise<void>, success: string): Promise<void> {
    const state = repository.state,
      podId = state.podId;
    if (!podId || state.busy) return;
    state.busy = true;
    redraw();
    try {
      await action(podId);
      await repository.load(podId, true);
      showToast(success);
    } catch (error) {
      reportError(error, { operation: "cloud" });
      showToast(message(error));
    } finally {
      state.busy = false;
    }
    redraw();
    void refreshPodView();
  }
  async function withdraw(podId: string, key: string): Promise<void> {
    try {
      await cloud.withdrawNomination(podId, key);
    } catch (error) {
      reportError(error, { operation: "cloud" });
    }
  }
  const value = (id: string): string =>
    body.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)?.value || "";
  body.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const state = repository.state;
    if (target.id === "impactPodSel") {
      if (state.busy) return;
      const podId = target.value;
      state.openReasonKey = null;
      state.busy = true;
      redraw();
      void repository
        .load(podId, true)
        .then((loaded) => {
          if (loaded) void refreshPodView();
        })
        .catch((error: unknown) => {
          reportError(error, { operation: "cloud" });
          showToast("Could not load that pod.");
        })
        .finally(() => {
          state.busy = false;
          redraw();
        });
      return;
    }
    const key = target.getAttribute("data-impact-toggle"),
      card = target.getAttribute("data-card");
    if (
      !(target instanceof HTMLInputElement) ||
      !key ||
      !card ||
      !canEdit(state, getCurrentUser()?.uid || null)
    )
      return;
    if (isDefault(card) && target.checked) {
      void write((id) => cloud.setImpactChange(id, key, null), `${card} is back in the pod list.`);
    } else if (isDefault(card)) {
      state.openReasonKey = key;
      void write(
        (id) => cloud.setImpactChange(id, key, { card, action: "remove" }),
        `${card} removed from the pod list.`,
      );
    } else if (!target.checked) {
      state.openReasonKey = null;
      void write(
        (id) => cloud.setImpactChange(id, key, null),
        `${card} dropped from the pod list.`,
      );
    }
  });
  body.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button || repository.state.busy) return;
    const state = repository.state;
    const key = button.getAttribute("data-impact-reason");
    if (key) {
      state.openReasonKey = state.openReasonKey === key ? null : key;
      redraw();
      return;
    }
    if (button.hasAttribute("data-impact-reason-cancel")) {
      state.openReasonKey = null;
      redraw();
      return;
    }
    const saveKey = button.getAttribute("data-impact-reason-save");
    if (saveKey) {
      const reason = value("impactReasonInput");
      state.openReasonKey = null;
      void write((id) => cloud.setImpactReason(id, saveKey, reason), "Reason saved.");
    } else if (button.hasAttribute("data-impact-more")) {
      state.candMore = true;
      redraw();
    } else if (button.hasAttribute("data-impact-restore")) {
      void write(cloud.clearImpactDismissed, "Turned-down cards are back in the queue.");
    } else if (button.id === "impactResetBtn") {
      if (!state.confirmReset) {
        state.confirmReset = true;
        button.textContent = "Click again to confirm the reset";
        return;
      }
      state.openReasonKey = null;
      void write(cloud.resetImpactSettings, "Pod list reset to the default.");
    } else {
      const actions = [
        ["add", "data-impact-add"],
        ["dismiss", "data-impact-dismiss"],
        ["nominate", "data-impact-nominate"],
        ["accept", "data-impact-nom-accept"],
        ["reject", "data-impact-nom-reject"],
        ["withdraw", "data-impact-nom-withdraw"],
      ] as const;
      const choice = actions.find(([, attr]) => button.hasAttribute(attr));
      if (!choice) return;
      const [action, attr] = choice,
        card = button.getAttribute(attr);
      if (!card) return;
      const key = impactKey(card);
      if (action === "add" || action === "accept") {
        state.openReasonKey = key;
        void write(async (id) => {
          await cloud.setImpactChange(id, key, { card, action: "add" });
          await withdraw(id, key);
        }, `${card} added to the pod list.`);
      } else if (action === "dismiss" || action === "reject") {
        void write(async (id) => {
          await cloud.setImpactDismiss(id, key, { card });
          if (action === "reject") await withdraw(id, key);
        }, `${card} turned down.`);
      } else if (action === "withdraw") {
        void write((id) => cloud.withdrawNomination(id, key), "Nomination withdrawn.");
      } else if (action === "nominate") {
        if (state.nominations.length >= 25) {
          showToast("Your pod already has 25 open nominations.");
          return;
        }
        const note = value("impactNomNote");
        void write((id) => cloud.nominateImpact(id, key, { card, note }), `${card} nominated.`);
      }
    }
  });
  body.addEventListener("input", (event) => {
    const input = event.target;
    if (
      !(input instanceof HTMLInputElement) ||
      !["impactSearch", "impactNomSearch"].includes(input.id)
    )
      return;
    const results = body.querySelector<HTMLElement>(
      input.id === "impactSearch" ? "#impactSearchHits" : "#impactNomHits",
    );
    if (!results) return;
    const effective = new Set(effectiveList(repository.state.changes).map((n) => n.toLowerCase()));
    const hits = ports
      .search(input.value, 8)
      .filter((c) => !effective.has(c.n.toLowerCase()) && !isDefault(c.n))
      .slice(0, 6);
    ports.searchStyles();
    ports.anchor(input, () =>
      render(
        hits.length
          ? hits
              .map(
                (c, i) =>
                  html`<button
                    type="button"
                    class=${`pm-sr-row${i === 0 ? " pm-sr-best" : ""}`}
                    data-impact-add=${input.id === "impactSearch" ? c.n : nothing}
                    data-impact-nominate=${input.id === "impactNomSearch" ? c.n : nothing}
                  >
                    <span class="pm-sr-name">+ ${highlighted(c.n, input.value)}</span>
                  </button>`,
              )
              .reverse()
          : input.value.trim().length >= 2
            ? html`<div class="pm-sr-note">No card found (or it is already on the list).</div>`
            : nothing,
        results,
      ),
    );
  });
  redraw();
}

function highlighted(name: string, query: string) {
  const normalize = (s: string) => s.toLowerCase().replace(/[\u2018\u2019\u02BC\u00B4`]/g, "'");
  const q = query.trim(),
    at = q.length >= 2 ? normalize(name).indexOf(normalize(q)) : -1;
  return at < 0
    ? name
    : html`${name.slice(0, at)}<mark>${name.slice(at, at + q.length)}</mark>${name.slice(at + q.length)}`;
}
