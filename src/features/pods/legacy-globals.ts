// TODO(p3-6): adapt shared inline dialogs/navigation and publish only surviving legacy pod names.
import { emit as emitAppEvent, on as onAppEvent } from "../../services/events";
import { openTadOverlay, closeTryADeckModal } from "../../ui/tad-modal";
import { mount } from "./index";

declare function refreshCloudChroniclesCache(): void;
declare function setMode(mode: string): void;
declare function showConfirmModal(message: string, onConfirm: () => void): void;
declare function showActionConfirmModal(
  message: string,
  label: string,
  onConfirm: () => void,
  onCancel?: () => void,
): void;

const panel = document.querySelector<HTMLElement>("#podMode > .panel");
if (!panel) throw new Error("Missing MyPods panel");

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
  paintOpenGatherings: (area, gatherings, uid) =>
    emitAppEvent("gatherings:paint", { area, gatherings, uid }),
});
onAppEvent("pods:refresh", () => {
  void feature.renderPanel();
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
