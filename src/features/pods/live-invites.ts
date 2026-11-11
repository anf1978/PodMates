// Landing-only Gathering subscriptions; a redraw/unmount owns and disposes every listener.
import { loadOpenGatherings, watchOpenGatherings } from "../../services/cloud/gatherings";
import { reportError } from "../../services/report-error";
import type { OpenGathering } from "./integration";
import type { Pod } from "./state";

export function watchInvites(
  pods: Pod[],
  area: HTMLElement,
  paint: (gatherings: OpenGathering[]) => void,
): () => void {
  let stopped = false;
  const unsubs: Array<() => void> = [];
  const byPod = new Map<string, OpenGathering[]>();
  const addPod = (pod: Pod, gatherings: Awaited<ReturnType<typeof loadOpenGatherings>>) =>
    gatherings.map((g) => ({ ...g, podId: pod.id, podName: pod.name }));
  const draw = (all: OpenGathering[]) => {
    if (stopped) return;
    if (!area.isConnected) stop();
    else paint(all);
  };
  const observer = new MutationObserver(() => {
    if (!area.isConnected) stop();
  });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    for (const unsubscribe of unsubs) unsubscribe();
  };

  Promise.all(
    pods.map(async (pod) => {
      try {
        return addPod(pod, await loadOpenGatherings(pod.id));
      } catch (error) {
        reportError(error, { operation: "cloud" });
        return [];
      }
    }),
  ).then((results) => draw(results.flat()));

  for (const pod of pods) {
    try {
      unsubs.push(
        watchOpenGatherings(
          pod.id,
          (gatherings) => {
            byPod.set(pod.id, addPod(pod, gatherings));
            draw([...byPod.values()].flat());
          },
          (error) => reportError(error, { operation: "cloud" }),
        ),
      );
    } catch (error) {
      reportError(error, { operation: "cloud" });
    }
  }
  observer.observe(area.ownerDocument.body, { childList: true, subtree: true });
  return stop;
}
