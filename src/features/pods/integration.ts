// Temporary ports for shared legacy dialogs and the not-yet-moved Gathering invitation painter.
import type { Gathering } from "../../services/cloud/gatherings";

export type OpenGathering = Gathering & { podId: string; podName: string };

export interface PodIntegration {
  openOverlay(onDismiss: () => void): HTMLElement;
  closeOverlay(): void;
  confirm(message: string, onConfirm: () => void): void;
  actionConfirm(message: string, label: string, onConfirm: () => void, onCancel?: () => void): void;
  paintOpenGatherings(area: HTMLElement, gatherings: OpenGathering[], uid: string | null): void;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
