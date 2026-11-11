// Public gathering API. Mounting only supplies a cleanup boundary; callers open views on demand.
import "./gatherings.css";
import { openHostGatheringOverlay as host } from "./host";
import { paintOpenGatherings as paint } from "./landing";
import { openLiveGatheringOverlay, stopGatheringPolling } from "./view";
import { runSampleGathering } from "./view";
import { on } from "../../services/events";
import type { LandingGathering, Member } from "./state";
export { configureGatherings, type GatheringRuntime } from "./runtime";
export {
  openLiveGatheringOverlay,
  openGatheringSeatDeckPicker,
  renderLiveGatheringTray,
  runSampleGathering,
  stopGatheringPolling,
} from "./view";
export { gatheringRsvp } from "./controls";

export function openHostGatheringOverlay(pod: { id: string }, members: Member[]): Promise<void> {
  return host(pod, members, openLiveGatheringOverlay);
}
export function paintOpenGatherings(
  area: HTMLElement | null,
  all: LandingGathering[],
  uid: string,
): void {
  paint(area, all, uid, openLiveGatheringOverlay);
}
export function mount(): () => void {
  const cleanups = [
    on("gatherings:open", ({ podId, id }) => {
      void openLiveGatheringOverlay(podId, id);
    }),
    on("gatherings:host", ({ pod, members }) => {
      void openHostGatheringOverlay(pod, members);
    }),
    on("gatherings:sample", () => {
      void runSampleGathering();
    }),
    on("gatherings:paint", ({ area, gatherings, uid }) =>
      paintOpenGatherings(area, gatherings, uid || ""),
    ),
  ];
  return () => {
    cleanups.forEach((off) => off());
    stopGatheringPolling();
  };
}
