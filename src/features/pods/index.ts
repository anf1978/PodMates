// Public pod lifecycle and controller; no DOM work happens until mount() is called.
import "./pods.css";
import { createPod, joinPodByInviteCode, loadMyPods } from "../../services/cloud/pods";
import { getCurrentUser, onAuthChange } from "../../services/cloud/session";
import { emit as emitAppEvent, on } from "../../services/events";
import { reportError } from "../../services/report-error";
import { nothing, render } from "../../ui/html";
import { showToast } from "../../ui/toast";
import { renderDetail } from "./detail";
import { errorMessage, type PodIntegration } from "./integration";
import { watchInvites } from "./live-invites";
import { initialState, inviteCode, selectPod, type Pod } from "./state";
import {
  formTemplate,
  landingTemplate,
  loadingTemplate,
  overlayTemplate,
  shellTemplate,
  signedOutTemplate,
} from "./view";

export interface PodsFeature {
  renderPanel(options?: { focusPodId?: string }): Promise<void>;
  openDetail(pod: Pod, pods: Pod[]): void;
  reopenDetail(pod: Pod): Promise<void>;
  getActivePodId(): string | null;
  setActivePodId(id: string | null): void;
  destroy(): void;
}

export function mount(panel: HTMLElement, ui: PodIntegration): PodsFeature {
  render(shellTemplate(), panel);
  const area = panel.querySelector<HTMLElement>("#ourPodPanelArea")!;
  let state = initialState(location.search);
  let disposed = false;
  let panelVersion = 0;
  let ownedModal: HTMLElement | null = null;
  let stopInvites = () => {};
  const setActivePodId = (id: string | null) => {
    state = { ...state, activePodId: id };
  };
  const close = () => {
    ui.closeOverlay();
    void renderPanel();
  };
  const overlay = () => {
    const modal = ui.openOverlay(close);
    ownedModal = modal;
    render(overlayTemplate(close), modal);
    return modal.querySelector<HTMLElement>("#podOverlayContent")!;
  };
  const refresh = async (container: HTMLElement, pods: Pod[]) => {
    if (disposed) return;
    state = selectPod(state, pods);
    if (!container.isConnected) {
      emitAppEvent("pods:active", state.activePodId);
      return;
    }
    if (!pods.length) {
      renderForm(container);
      return;
    }
    await renderDetail(
      container,
      pods.find((p) => p.id === state.activePodId)!,
      pods,
      {
        ui,
        refresh,
        reopen: reopenDetail,
        setActive: setActivePodId,
      },
    );
  };
  function openDetail(pod: Pod, pods: Pod[]): void {
    setActivePodId(pod.id);
    void refresh(overlay(), pods);
  }
  async function reopenDetail(pod: Pod): Promise<void> {
    let pods: Pod[] = [];
    try {
      pods = await loadMyPods();
    } catch (error) {
      reportError(error, { operation: "cloud" });
    }
    if (!disposed) openDetail(pod, pods);
  }
  function renderForm(container: HTMLElement): void {
    emitAppEvent("pods:active", state.activePodId);
    const submit = async (kind: "create" | "join") => {
      const input = container.querySelector<HTMLInputElement>(
        kind === "create" ? "#podCreateNameInput" : "#podJoinCodeInput",
      )!;
      const status = container.querySelector<HTMLElement>("#podModalStatus")!;
      const button = container.querySelector<HTMLButtonElement>(
        kind === "create" ? "#podCreateBtn" : "#podJoinBtn",
      )!;
      const showError = (message: string) => {
        status.textContent = message;
        status.className = "status err";
      };
      if (kind === "join" && !input.value.trim()) {
        showError("Paste an invite link or code first.");
        return;
      }
      button.disabled = true;
      button.textContent = kind === "create" ? "Creating…" : "Joining…";
      try {
        if (kind === "create") {
          const result = await createPod(input.value);
          setActivePodId(result.podId);
          await refresh(container, await loadMyPods());
          showToast(`"${input.value.trim() || "Our Pod"}" created.`);
        } else {
          const result = await joinPodByInviteCode(inviteCode(input.value));
          if (!result.ok) {
            showError(result.error);
            return;
          }
          setActivePodId(result.podId);
          await refresh(container, await loadMyPods());
          showToast(`Joined "${result.podName}."`);
        }
      } catch (error) {
        reportError(error, { operation: "cloud" });
        showError(
          (kind === "create" ? "Could not create the pod: " : "Could not join: ") +
            errorMessage(error),
        );
      } finally {
        button.disabled = false;
        button.textContent = kind === "create" ? "Create" : "Join";
      }
    };
    render(
      formTemplate(
        () => void submit("create"),
        () => void submit("join"),
      ),
      container,
    );
  }
  function openForm(focus: "create" | "join"): void {
    const container = overlay();
    renderForm(container);
    if (focus === "join") container.querySelector<HTMLInputElement>("#podJoinCodeInput")!.focus();
  }
  async function renderPanel(options?: { focusPodId?: string }): Promise<void> {
    if (disposed) return;
    const version = ++panelVersion;
    stopInvites();
    if (!getCurrentUser()) {
      render(
        signedOutTemplate(() => emitAppEvent("auth:open", undefined)),
        area,
      );
      return;
    }
    render(loadingTemplate("Loading your pods…"), area);
    let pods: Pod[] = [];
    try {
      pods = await loadMyPods();
    } catch (error) {
      reportError(error, { operation: "cloud" });
    }
    if (disposed || version !== panelVersion) return;
    state = selectPod(state, pods, options?.focusPodId);
    render(
      landingTemplate(
        pods,
        (pod) => openDetail(pod, pods),
        () => openForm("create"),
        () => openForm("join"),
        () => emitAppEvent("gatherings:sample", undefined),
      ),
      area,
    );
    const liveArea = area.querySelector<HTMLElement>("#myPodsLiveGatheringArea")!;
    const uid = getCurrentUser()?.uid ?? null;
    stopInvites = watchInvites(pods, liveArea, (all) => ui.paintOpenGatherings(liveArea, all, uid));
    if (options?.focusPodId) {
      const pod = pods.find((p) => p.id === state.activePodId);
      if (pod) openDetail(pod, pods);
    }
  }

  const offOpen = on("pods:open", ({ pod, pods }) => openDetail(pod, pods));
  onAuthChange((user) => {
    if (disposed || !state.pendingJoinCode) return;
    if (user && !user.isAnonymous) {
      const code = state.pendingJoinCode;
      state = { ...state, pendingJoinCode: null };
      history.replaceState({}, "", location.pathname);
      ui.actionConfirm(
        "Join the pod from this invite? Its members will be able to see your non-secret saved decks.",
        "Join pod",
        async () => {
          try {
            const result = await joinPodByInviteCode(code);
            if (result.ok) {
              setActivePodId(result.podId);
              showToast(`Joined "${result.podName}."`);
              emitAppEvent("pods:navigate", undefined);
            } else {
              showToast(result.error);
            }
          } catch (error) {
            reportError(error, { operation: "cloud" });
            showToast("Could not join the pod: " + errorMessage(error));
          }
        },
      );
    } else if (!state.promptedForJoin) {
      state = { ...state, promptedForJoin: true };
      showToast("Sign in or create an account to join this pod.");
      emitAppEvent("auth:open", undefined);
    }
  });

  return {
    renderPanel,
    openDetail,
    reopenDetail,
    getActivePodId: () => state.activePodId,
    setActivePodId,
    destroy() {
      disposed = true;
      offOpen();
      ++panelVersion;
      stopInvites();
      if (ownedModal?.isConnected) ui.closeOverlay();
      render(nothing, panel);
    },
  };
}
