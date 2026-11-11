// In-app inbox lifecycle; repositories supply feeds, typed events supply navigation.
import "./notifications.css";
import { watchActivity } from "../../services/cloud/activity";
import { loadMyPods } from "../../services/cloud/pods";
import { getCurrentUser, onAuthChange } from "../../services/cloud/session";
import { emit, on } from "../../services/events";
import { reportError } from "../../services/report-error";
import { render } from "../../ui/html";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import { initialState, opensGathering, unreadCount, type NotificationItem } from "./state";
import { load, save } from "./storage";
import { bellView, bodyView, modalView } from "./view";

export interface NotificationsFeature {
  open(): void;
  restart(): Promise<void>;
  unread(): number;
  destroy(): void;
}

export function mount(bar: HTMLElement): NotificationsFeature {
  let state = initialState();
  let disposed = false,
    version = 0,
    openSince = 0;
  let modal: HTMLElement | null = null;
  const unsubs: (() => void)[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fragment = document.createDocumentFragment();
  render(bellView(open), fragment);
  const bell = fragment.querySelector<HTMLButtonElement>("#pmBellBtn")!;
  const badge = fragment.querySelector<HTMLElement>("#pmBellBadge")!;
  bar.prepend(fragment);

  function updateBadge(): void {
    const n = unreadCount(state, Date.now());
    badge.textContent = n > 9 ? "9+" : String(n);
    badge.classList.toggle("pm-notif-unread", n > 0);
    bell.classList.toggle("pm-notif-signed-in", Boolean(state.uid));
    bell.setAttribute("aria-label", n ? "Notifications, " + n + " new" : "Notifications");
  }
  function redraw(): void {
    if (!modal?.isConnected) return;
    const body = modal.querySelector<HTMLElement>("#pmNotifBody")!;
    const expanded = body.querySelector("details")?.open;
    render(
      bodyView(
        state,
        openSince,
        {
          openItem,
          preference: (group, key, checked) => {
            state.prefs[group][key] = checked;
            if (state.uid) save("pm_notif_prefs_" + state.uid, JSON.stringify(state.prefs));
            updateBadge();
            redraw();
          },
        },
        Date.now(),
      ),
      body,
    );
    const details = body.querySelector("details");
    if (details && expanded) details.open = true;
  }
  function stop(): void {
    version++;
    unsubs.splice(0).forEach((off) => {
      try {
        off();
      } catch (error) {
        reportError(error, { operation: "cloud" });
      }
    });
    state.feeds.clear();
  }
  async function restart(): Promise<void> {
    if (disposed) return;
    stop();
    const request = version,
      user = getCurrentUser();
    state = initialState();
    if (!user || user.isAnonymous) {
      updateBadge();
      redraw();
      return;
    }
    state.uid = user.uid;
    Object.assign(state, load(user.uid, Date.now()));
    updateBadge();
    try {
      const pods = await loadMyPods();
      if (disposed || version !== request || getCurrentUser()?.uid !== user.uid) return;
      state.pods = pods;
      for (const pod of pods) {
        try {
          unsubs.push(
            watchActivity(pod.id, (items) => {
              if (disposed || version !== request || getCurrentUser()?.uid !== user.uid) return;
              state.feeds.set(pod.id, items);
              updateBadge();
              redraw();
            }),
          );
        } catch (error) {
          reportError(error, { operation: "cloud" });
        }
      }
    } catch (error) {
      reportError(error, { operation: "cloud" });
    }
    if (version === request) {
      updateBadge();
      redraw();
    }
  }
  function restartSoon(): void {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void restart();
    }, 600);
  }
  function openItem(item: NotificationItem): void {
    closeTryADeckModal();
    if (opensGathering(item)) {
      emit("gatherings:open", { podId: item.podId, id: item.ref! });
      return;
    }
    const pod = state.pods.find((p) => p.id === item.podId);
    if (pod) emit("pods:open", { pod, pods: state.pods });
  }
  function open(): void {
    if (disposed) return;
    modal = openTadOverlay({ modalClass: "tad-modal pm-notif-modal" }).modal;
    openSince = state.seenAt;
    render(modalView(closeTryADeckModal), modal);
    redraw();
    state.seenAt = Date.now();
    if (state.uid) save("pm_notif_seen_" + state.uid, String(state.seenAt));
    updateBadge();
    void restart();
  }
  const offMembership = on("pods:membership", restartSoon);
  onAuthChange(() => {
    if (disposed) return;
    stop();
    state = initialState();
    updateBadge();
    redraw();
    restartSoon();
  });
  const visibility = (): void => {
    if (!document.hidden) updateBadge();
  };
  document.addEventListener("visibilitychange", visibility);

  return {
    open,
    restart,
    unread: () => unreadCount(state, Date.now()),
    destroy: () => {
      disposed = true;
      clearTimeout(timer);
      stop();
      offMembership();
      document.removeEventListener("visibilitychange", visibility);
      if (modal?.isConnected) closeTryADeckModal();
      bell.remove();
    },
  };
}
