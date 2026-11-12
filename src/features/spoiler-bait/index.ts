// Public Spoiler Bait lifecycle; repositories own all persisted votes.
import "./spoiler-bait.css";
import { getCurrentUser } from "../../services/cloud/session";
import * as cloud from "../../services/cloud/spoiler-votes";
import { on } from "../../services/events";
import { reportError } from "../../services/report-error";
import { nothing, render } from "../../ui/html";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import { showToast } from "../../ui/toast";
import { enrichRarities, fetchSpoilers, signalCards, type Signal } from "./data";
import { wireSwipe } from "./gestures";
import {
  boardRows,
  createState,
  queue,
  RARITIES,
  setVote,
  type PodVotes,
  type SpoilerCard,
  type Vote,
} from "./state";
import { boardView, listView, modalView, note, swipeView, tabsView, type Actions } from "./view";

export interface MountOptions {
  mode?: "pod" | "ps";
  podId?: string | null;
  signals?: readonly Signal[];
  day?: string;
  onOpen?: (name: string) => void;
}
export interface SpoilerBaitView {
  ready: Promise<void>;
  destroy(): void;
}
let activePodId: string | null | undefined;
let current: SpoilerBaitView | null = null;

function readRarities(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem("pm-sb-rarities") || "null");
    if (Array.isArray(stored) && stored.every((value) => typeof value === "string")) return stored;
  } catch (error) {
    reportError(error, { operation: "spoiler-bait", severity: "warning" });
  }
  return RARITIES.map(([key]) => key);
}
const message = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export function mount(host: HTMLElement, options: MountOptions = {}): SpoilerBaitView {
  current?.destroy();
  const state = createState(readRarities());
  const uid = getCurrentUser()?.uid;
  let disposed = false,
    version = 0;
  let stopSwipe = (): void => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let podBoard: { podId: string; members: PodVotes[] } | null = null;
  const podId = (): string | null =>
    options.mode === "ps"
      ? activePodId === undefined
        ? options.podId || null
        : activePodId
      : options.podId || null;
  const live = (): boolean => !disposed && host.isConnected;
  const sameAccount = (): boolean => uid !== undefined && getCurrentUser()?.uid === uid;
  function rememberRarities(): void {
    try {
      localStorage.setItem("pm-sb-rarities", JSON.stringify([...state.rarities]));
    } catch (error) {
      reportError(error, { operation: "spoiler-bait", severity: "warning" });
    }
    redraw();
  }
  async function save(card: SpoilerCard, vote: Vote): Promise<void> {
    setVote(state, card, vote, Date.now());
    try {
      await cloud.setSpoilerVote({ key: card.key, n: card.n, setName: card.setName || "" }, vote);
      podBoard = null;
    } catch (error) {
      reportError(error, { operation: "cloud" });
      showToast(`Could not save that vote: ${message(error, "try again")}`);
    }
  }
  async function clear(key: string): Promise<void> {
    state.votes.delete(key);
    try {
      await cloud.clearSpoilerVote(key);
      podBoard = null;
    } catch (error) {
      reportError(error, { operation: "cloud" });
      showToast(`Could not undo that: ${message(error, "try again")}`);
    }
  }
  function decide(card: SpoilerCard, vote: Vote): void {
    if (!live() || state.busy) return;
    if (!sameAccount()) {
      redraw();
      return;
    }
    state.busy = true;
    const top = host.querySelector<HTMLElement>("#sbTop"),
      dir = vote === "like" ? -1 : 1;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    host.querySelector(".sb-btns")?.classList.add("sb-wait");
    stopSwipe();
    if (top) {
      top.classList.add("sb-fly");
      top.style.transform = `translateX(${dir * 420}px) rotate(${dir * 22}deg)`;
    }
    state.undo.push(card.key);
    void save(card, vote);
    timer = setTimeout(
      () => {
        state.busy = false;
        redraw();
      },
      top ? 130 : 0,
    );
  }
  const actions: Actions = {
    tab: (tab) => {
      state.tab = tab;
      redraw();
    },
    rarity: (key) => {
      if (state.rarities.has(key)) state.rarities.delete(key);
      else state.rarities.add(key);
      rememberRarities();
    },
    allRarities: () => {
      state.rarities = new Set(RARITIES.map(([key]) => key));
      rememberRarities();
    },
    decide,
    undo: () => {
      if (!sameAccount()) {
        redraw();
        return;
      }
      const key = state.undo.pop();
      if (key)
        void clear(key).then(() => {
          state.tab = "swipe";
          redraw();
        });
    },
    move: (vote, to) => {
      if (!sameAccount()) {
        redraw();
        return;
      }
      void save(vote, to).then(redraw);
    },
    clear: (key) => {
      if (!sameAccount()) {
        redraw();
        return;
      }
      void clear(key).then(redraw);
    },
    open: options.onOpen,
  };
  async function board(body: HTMLElement, id: string, generation: number): Promise<void> {
    render(note("Gathering your pod’s votes…"), body);
    try {
      const members =
        podBoard?.podId === id ? podBoard.members : await cloud.loadPodSpoilerVotes(id);
      if (!live() || !sameAccount() || generation !== version || podId() !== id) return;
      podBoard = { podId: id, members };
      render(boardView(boardRows(members), state.cards), body);
    } catch (error) {
      reportError(error, { operation: "cloud" });
      if (live() && generation === version)
        render(note(`Couldn’t load the pod’s votes (${message(error, "network")}).`), body);
    }
  }
  function redraw(): void {
    if (!live()) return;
    version++;
    stopSwipe();
    // Retire old DOM (including replaced broken images and dynamic swipe transforms).
    render(nothing, host);
    if (!sameAccount()) {
      render(
        note("Sign in to your PodMates account to use Spoiler Bait, so your likes are saved."),
        host,
      );
      return;
    }
    render(tabsView(state, Boolean(podId()), actions), host);
    const body = host.querySelector<HTMLElement>("#sbBody")!;
    if (state.tab === "swipe") {
      render(swipeView(state, actions), body);
      const top = body.querySelector<HTMLElement>("#sbTop"),
        card = queue(state)[0];
      if (top && card)
        stopSwipe = wireSwipe(
          top,
          () => state.busy,
          (vote) => decide(card, vote),
        );
    } else if (state.tab === "liked" || state.tab === "binned") {
      render(listView(state, state.tab === "liked" ? "like" : "pass", actions), body);
    } else {
      const id = podId();
      if (id) void board(body, id, version);
    }
  }
  async function load(): Promise<void> {
    if (!uid) {
      redraw();
      return;
    }
    render(note("Loading this week’s spoilers…"), host);
    try {
      state.cards =
        options.mode === "ps"
          ? signalCards(options.signals || [], options.day || "")
          : await fetchSpoilers();
      if (options.mode === "ps") await enrichRarities(state.cards);
      if (!live() || !sameAccount()) return;
      const votes = await cloud.loadSpoilerVotes(uid);
      if (!live() || !sameAccount()) return;
      state.votes = new Map(votes.map((vote) => [vote.key, vote]));
    } catch (error) {
      reportError(error, { operation: "spoiler-bait" });
      if (live())
        render(
          note(`Couldn’t load the spoilers (${message(error, "network")}). Try again in a moment.`),
          host,
        );
      return;
    }
    redraw();
  }
  const observer = new MutationObserver(() => {
    if (!host.isConnected) view.destroy();
  });
  const view: SpoilerBaitView = {
    ready: load(),
    destroy: () => {
      disposed = true;
      version++;
      stopSwipe();
      clearTimeout(timer);
      observer.disconnect();
      render(nothing, host);
      if (current === view) current = null;
    },
  };
  observer.observe(document.body, { childList: true, subtree: true });
  current = view;
  return view;
}

export function openSpoilerBaitOverlay(pod: { id: string }): void {
  const { modal } = openTadOverlay({
    onDismiss: () => {
      view.destroy();
      closeTryADeckModal();
    },
  });
  render(
    modalView(() => {
      view.destroy();
      closeTryADeckModal();
    }),
    modal,
  );
  const view = mount(modal.querySelector<HTMLElement>("#sbHost")!, { mode: "pod", podId: pod.id });
}

export function connect(): () => void {
  const stopOpen = on("spoilers:open", openSpoilerBaitOverlay);
  const stopPod = on("pods:active", (id) => {
    activePodId = id;
  });
  return () => {
    stopOpen();
    stopPod();
    current?.destroy();
  };
}
