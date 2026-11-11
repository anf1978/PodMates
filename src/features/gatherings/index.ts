// Public gathering API. Mounting only supplies a cleanup boundary; callers open views on demand.
import "./gatherings.css";
import { openHostGatheringOverlay as host } from "./host";
import { paintOpenGatherings as paint } from "./landing";
import { openLiveGatheringOverlay, stopGatheringPolling } from "./view";
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
  return stopGatheringPolling;
}
