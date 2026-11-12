// One live listener, with bounded polling fallback and deterministic teardown.
import { watchGathering, type Gathering } from "../../services/cloud/gatherings";
import { gatheringSignature } from "./state";
import { reportError } from "../../services/report-error";

export function watchTray(
  podId: string,
  id: string,
  content: HTMLElement,
  update: (g?: Gathering | null) => void,
): () => void {
  let stopped = false;
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let signature: string | undefined;
  const stop = (): void => {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = undefined;
    unsubscribe?.();
    unsubscribe = undefined;
    observer.disconnect();
  };
  const observer = new MutationObserver(() => {
    if (!content.isConnected) stop();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const fallback = (): void => {
    unsubscribe?.();
    unsubscribe = undefined;
    if (stopped || timer) return;
    timer = setInterval(() => {
      if (!content.isConnected) {
        stop();
        return;
      }
      if (!content.dataset.confirming) update();
    }, 8000);
  };
  try {
    const off = watchGathering(
      podId,
      id,
      (g, metadata) => {
        if (stopped || metadata.hasPendingWrites) return;
        if (!content.isConnected) {
          stop();
          return;
        }
        const next = gatheringSignature(g);
        if (next === signature) return;
        signature = next;
        if (!content.dataset.confirming) update(g);
      },
      fallback,
    );
    if (stopped || timer) off();
    else unsubscribe = off;
  } catch (error) {
    reportError(error, { operation: "gatherings" });
    fallback();
  }
  return stop;
}
