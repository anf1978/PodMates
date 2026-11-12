// Mounts MyPods with the shared dialogs, and provides the active pod to the other boundaries.
import { refreshCloudChroniclesCache } from "../features/chronicles";
import { mount } from "../features/pods";
import { emit, on } from "../services/events";
import { showActionConfirmModal, showConfirmModal } from "../ui/confirm";
import { closeTryADeckModal, openTadOverlay } from "../ui/tad-modal";
import { provideActivePod } from "./active-pod";
import { setMode } from "./mode";

const panel = document.querySelector<HTMLElement>("#podMode > .panel");
if (!panel) throw new Error("Missing MyPods panel");

on("pods:active", () => void refreshCloudChroniclesCache());
on("pods:navigate", () => {
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
    emit("gatherings:paint", { area, gatherings, uid }),
});
on("pods:refresh", () => void feature.renderPanel());
provideActivePod(feature.getActivePodId);
