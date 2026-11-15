// Tutorials: a welcome card on a first visit, the first-chart tour, and a Help & tips button to replay
// it. The tour never opens or closes dialogs for the visitor: each step points at the next control and
// waits (closing Try a Deck, or wandering off, just leaves the step in place). Remembered on this
// device only.
import { on } from "../../services/events";
import { reportError } from "../../services/report-error";
import { render } from "../../ui/html";
import { closeTryADeckModal, openTadOverlay } from "../../ui/tad-modal";
import {
  LATER_KEY,
  markSeen,
  parseTips,
  shouldWelcome,
  STORAGE_KEY,
  TOUR,
  TOUR_STEPS,
  WELCOME,
  type TipsState,
} from "./state";
import { cardView, helpButtonView, helpMenuView, type CardContent } from "./view";

export interface TutorialsFeature {
  /** Starts the first-chart tour from the beginning. */
  startTour(): void;
  destroy(): void;
}

function readTips(): TipsState {
  try {
    return parseTips(localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    reportError(error, { operation: "tutorials" });
    return parseTips(null);
  }
}

function writeTips(tips: TipsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tips));
  } catch (error) {
    reportError(error, { operation: "tutorials" });
  }
}

function laterThisVisit(set?: boolean): boolean {
  try {
    if (set) sessionStorage.setItem(LATER_KEY, "1");
    return sessionStorage.getItem(LATER_KEY) === "1";
  } catch {
    return Boolean(set);
  }
}

const visible = (el: Element | null): el is HTMLElement =>
  !!el && (el as HTMLElement).getClientRects().length > 0;

export function mount(bar: HTMLElement): TutorialsFeature {
  let tips = readTips();
  let step: number | null = null;
  let target: HTMLElement | null = null;

  const host = document.createElement("div");
  host.id = "pmTutorial";
  host.className = "tut-host";
  document.body.append(host);

  const helpSlot = document.createElement("span");
  render(helpButtonView(openHelp), helpSlot);
  bar.prepend(...helpSlot.childNodes);

  // Tips stay out of the way of any open dialog, and come back when it closes.
  const syncOverlay = () => {
    host.hidden = Boolean(document.getElementById("tadOverlay"));
  };
  const observer = new MutationObserver(syncOverlay);
  observer.observe(document.body, { childList: true });

  const save = (next: TipsState) => {
    tips = next;
    writeTips(tips);
  };

  function clearTarget(): void {
    target?.classList.remove("tut-target");
    target = null;
  }

  function show(content: CardContent | null): void {
    render(content ? cardView(content) : null, host);
    syncOverlay();
  }

  function stop(): void {
    step = null;
    clearTarget();
    show(null);
  }

  function later(): void {
    laterThisVisit(true);
    stop();
  }

  function finish(): void {
    save(markSeen(markSeen(tips, WELCOME), TOUR));
    stop();
  }

  function showStep(index: number): void {
    clearTarget();
    let i = index;
    // Skip "Next" steps whose target is not on the page (a panel this deck doesn't have).
    while (i < TOUR_STEPS.length) {
      const s = TOUR_STEPS[i]!;
      const el = s.target ? document.querySelector(s.target) : null;
      const panel = el?.closest<HTMLElement>(".panel") || (el as HTMLElement | null);
      if (s.target && s.advance === "next" && !visible(panel)) {
        i++;
        continue;
      }
      step = i;
      if (s.target && panel) {
        target = panel;
        target.classList.add("tut-target");
        target.scrollIntoView?.({ behavior: "smooth", block: "center" });
      }
      const last = i === TOUR_STEPS.length - 1;
      show({
        title: s.title,
        text: s.text,
        progress: last ? null : `Step ${i + 1} of ${TOUR_STEPS.length - 1}`,
        buttons: last
          ? [{ label: "Done", primary: true, run: finish }]
          : s.advance === "next"
            ? [
                { label: "Skip tour", run: finish },
                { label: "Next", primary: true, run: () => showStep(i + 1) },
              ]
            : [
                { label: "Later", run: later },
                { label: "Skip tour", run: finish },
              ],
      });
      return;
    }
    finish();
  }

  function startTour(): void {
    showStep(0);
  }

  function welcome(): void {
    show({
      title: "Welcome to PodMates",
      text: "Chart a real Commander precon in a few taps and see what PodMates tells you about it.",
      progress: null,
      buttons: [
        {
          label: "No thanks",
          run: () => {
            save(markSeen(tips, WELCOME));
            stop();
          },
        },
        { label: "Later", run: later },
        { label: "Show me", primary: true, run: startTour },
      ],
    });
  }

  function advance(event: "samples:chosen" | "chart:done"): void {
    if (step === null) return;
    const current = TOUR_STEPS[step]!;
    if (current.advance === event) showStep(step + 1);
    // Charted a pasted or loaded deck instead of a sample: go straight to the results.
    else if (event === "chart:done" && current.advance !== "next")
      showStep(TOUR_STEPS.findIndex((s) => s.id === "radar"));
  }

  function openHelp(): void {
    const { modal } = openTadOverlay();
    const draw = () =>
      render(
        helpMenuView(tips.off, {
          close: closeTryADeckModal,
          tour() {
            closeTryADeckModal();
            save({ ...tips, off: false });
            startTour();
          },
          toggle() {
            save({ ...tips, off: !tips.off });
            if (tips.off) stop();
            draw();
          },
          reset() {
            save({ ...tips, seen: [] });
            draw();
          },
        }),
        modal,
      );
    draw();
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && host.childElementCount && !host.hidden) later();
  };
  document.addEventListener("keydown", onKey);
  const offs = [
    on("samples:chosen", () => advance("samples:chosen")),
    on("chart:done", () => advance("chart:done")),
  ];

  if (shouldWelcome(tips, laterThisVisit())) welcome();

  return {
    startTour,
    destroy() {
      offs.forEach((off) => off());
      observer.disconnect();
      document.removeEventListener("keydown", onKey);
      clearTarget();
      host.remove();
      document.getElementById("pmHelpBtn")?.remove();
    },
  };
}
