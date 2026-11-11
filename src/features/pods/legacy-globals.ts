// TODO(p3-6): adapt shared inline dialogs/navigation and publish only surviving legacy pod names.
import { on as onAppEvent } from "../../services/events";
import type { PodMember } from "../../services/cloud/types";
import { openTadOverlay, closeTryADeckModal } from "../../ui/tad-modal";
import { mount } from "./index";
import type { OpenGathering } from "./integration";
import type { Pod } from "./state";

declare function runSampleGathering(): void;
declare function openHostGatheringOverlay(pod: Pod, members: PodMember[]): void;
declare function openSpoilerBaitOverlay(pod: Pod): void;
declare function refreshCloudChroniclesCache(): void;
declare function setMode(mode: string): void;
declare function showConfirmModal(message: string, onConfirm: () => void): void;
declare function showActionConfirmModal(
  message: string,
  label: string,
  onConfirm: () => void,
  onCancel?: () => void,
): void;
declare function paintOpenGatherings(
  area: HTMLElement,
  all: OpenGathering[],
  uid: string | null,
): void;

const panel = document.querySelector<HTMLElement>("#podMode > .panel");
if (!panel) throw new Error("Missing MyPods panel");

onAppEvent("gatherings:sample", () => runSampleGathering());
onAppEvent("gatherings:host", ({ pod, members }) => openHostGatheringOverlay(pod, members));
onAppEvent("spoilers:open", (pod) => openSpoilerBaitOverlay(pod));
onAppEvent("pods:active", () => refreshCloudChroniclesCache());
onAppEvent("pods:navigate", () => {
  setMode("pod");
  document.getElementById("podMode")?.scrollIntoView({ behavior: "smooth" });
});

const feature = mount(panel, {
  openOverlay: (onDismiss) => openTadOverlay({ onDismiss }).modal,
  closeOverlay: () => closeTryADeckModal(),
  confirm: (message, onConfirm) => showConfirmModal(message, onConfirm),
  actionConfirm: (message, label, onConfirm, onCancel) =>
    showActionConfirmModal(message, label, onConfirm, onCancel),
  paintOpenGatherings: (area, all, uid) => paintOpenGatherings(area, all, uid),
});

declare global {
  interface Window {
    // TODO(p3-6): profile, Spoiler Bait and Chronicles still read the active pod.
    currentPodViewId: string | null;
    // TODO(p3-6): inline navigation and Gatherings still refresh this panel.
    renderOurPodPanel: typeof feature.renderPanel;
    // TODO(p3-6): the notifications inbox still opens pod details.
    openPodDetailOverlay: typeof feature.openDetail;
  }
}

Object.defineProperty(window, "currentPodViewId", {
  configurable: true,
  get: feature.getActivePodId,
  set: feature.setActivePodId,
});
Object.assign(window, {
  renderOurPodPanel: feature.renderPanel,
  openPodDetailOverlay: feature.openDetail,
});
