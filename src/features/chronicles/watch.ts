// Battle-result subscription with the legacy eight-second fallback and stale-context teardown.
import { loadGathering, watchGathering, type Gathering } from "../../services/cloud/gatherings";
import { reportError } from "../../services/report-error";
import type { ChronicleBattle } from "./state";

export function watchBattleResults(
  context: ChronicleBattle,
  active: () => boolean,
  logged: (id: string) => void,
): () => void {
  let stopped = false;
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = (): void => {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = undefined;
    const off = unsubscribe;
    unsubscribe = undefined;
    if (off) {
      try {
        off();
      } catch (error) {
        reportError(error, { operation: "cloud" });
      }
    }
  };
  const handle = (gathering: Gathering | null): void => {
    if (stopped) return;
    if (!active() || context.loggedChronicleId || !gathering || gathering.status === "ended") {
      stop();
      return;
    }
    const id = gathering.lastLoggedChronicleId;
    if (id && id !== context.ignoreChronicleId) {
      stop();
      logged(id);
    }
  };
  const fallback = (): void => {
    if (stopped || timer) return;
    const off = unsubscribe;
    unsubscribe = undefined;
    if (off) {
      try {
        off();
      } catch (error) {
        reportError(error, { operation: "cloud" });
      }
    }
    timer = setInterval(async () => {
      if (stopped) return;
      if (!active() || context.loggedChronicleId) {
        stop();
        return;
      }
      try {
        handle(await loadGathering(context.podId, context.gatheringId));
      } catch (error) {
        reportError(error, { operation: "cloud" });
      }
    }, 8000);
  };
  try {
    const off = watchGathering(
      context.podId,
      context.gatheringId,
      (gathering, metadata) => {
        if (!metadata.hasPendingWrites) handle(gathering);
      },
      (error) => {
        reportError(error, { operation: "cloud" });
        fallback();
      },
    );
    if (stopped || timer) off();
    else unsubscribe = off;
  } catch (error) {
    reportError(error, { operation: "cloud" });
    fallback();
  }
  return stop;
}
