// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emit } from "../../services/events";
import { closeAllModals } from "../../ui/modal";
import { mount, type TutorialsFeature } from "./index";
import { markSeen, parseTips, shouldWelcome, STORAGE_KEY, TOUR_STEPS } from "./state";

vi.mock("../../services/report-error", () => ({ reportError: vi.fn() }));

let feature: TutorialsFeature;
const card = () => document.querySelector<HTMLElement>("#pmTutorial .tut-card");
const title = () => card()?.querySelector(".tut-title")?.textContent?.trim();
const press = (label: string) =>
  [...(card()?.querySelectorAll("button") ?? [])]
    .find((b) => b.textContent?.trim() === label)!
    .click();
const stored = () => parseTips(localStorage.getItem(STORAGE_KEY));
const settle = () => new Promise((resolve) => setTimeout(resolve, 80)); // the page watcher waits 50 ms

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = `<div id="authBar"></div>
    <div class="row" id="toolRow"><button id="chartBtn">Chart Deck</button>
    <button id="viewDeckBtn" aria-label="View Deck"><svg id="vdIcon"><path d="M0 0"/></svg></button>
    <button id="sampleBtn">Try a Deck</button></div>
    <div class="panel"><div id="chartArea"></div></div>
    <div class="panel"><div id="bracketArea"></div></div>
    <div class="panel"><div id="archetypeMatchCallout"></div></div>
    <div class="panel" id="keyPiecesPanel" style="display:none"></div>
    <div class="panel" id="legalityPanel"></div>
    <div class="panel" id="deckLogPanel"></div>`;
  // happy-dom has no layout: treat anything not display:none as on screen.
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    return ((this as HTMLElement).style.display === "none" ? [] : [{}]) as unknown as DOMRectList;
  });
});

afterEach(() => {
  feature?.destroy();
  closeAllModals();
  vi.restoreAllMocks();
});

const start = () => (feature = mount(document.getElementById("authBar")!));

describe("welcome", () => {
  it("greets a first visit, and adds the Help button", () => {
    start();
    expect(title()).toBe("Welcome to PodMates");
    expect(document.querySelector("#authBar #pmHelpBtn")?.getAttribute("aria-label")).toBe(
      "Help and tips",
    );
  });

  it("Later hides it for this visit only", () => {
    start();
    press("Later");
    expect(card()).toBeNull();
    feature.destroy();
    start();
    expect(card()).toBeNull(); // same visit
    sessionStorage.clear();
    feature.destroy();
    start();
    expect(title()).toBe("Welcome to PodMates"); // next visit
  });

  it("No thanks remembers it on this device", () => {
    start();
    press("No thanks");
    expect(stored().seen).toContain("welcome");
    feature.destroy();
    start();
    expect(card()).toBeNull();
  });

  it("Escape is the same as Later", () => {
    start();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(card()).toBeNull();
    expect(stored().seen).toEqual([]);
  });

  it("stays hidden while a dialog is open", async () => {
    start();
    const overlay = document.createElement("div");
    overlay.id = "tadOverlay";
    document.body.append(overlay);
    await settle();
    expect(document.getElementById("pmTutorial")!.hidden).toBe(true);
    overlay.remove();
    await settle();
    expect(document.getElementById("pmTutorial")!.hidden).toBe(false);
  });
});

describe("first-chart tour", () => {
  it("waits for the visitor at each control, then walks through the results", () => {
    start();
    press("Show me");
    expect(title()).toBe("Pick a deck");
    expect(document.getElementById("sampleBtn")!.classList.contains("tut-target")).toBe(true);
    emit("samples:chosen", { key: "uril" });
    expect(title()).toBe("Chart it");
    expect(document.getElementById("sampleBtn")!.classList.contains("tut-target")).toBe(false);
    emit("chart:done", undefined);
    const seenTitles = [title()];
    while (card()?.textContent?.includes("Next")) {
      press("Next");
      seenTitles.push(title());
    }
    // The combos panel is hidden for this deck, so its step is skipped.
    expect(seenTitles).toEqual([
      "The deck's profile",
      "Command Spark",
      "Bracket",
      "Closest match",
      "Structure and legality",
      "Deck Log",
      "Deck tools",
      "That's the tour",
    ]);
    press("Done");
    expect(card()).toBeNull();
    expect(stored().seen).toEqual(["welcome", "tour-first-chart"]);
    expect(document.querySelectorAll(".tut-target")).toHaveLength(0);
  });

  it("goes straight to the results when the visitor charts their own deck", () => {
    start();
    press("Show me");
    emit("chart:done", undefined);
    expect(title()).toBe("The deck's profile");
  });

  it("Later mid-tour stops it and offers the welcome again next visit", () => {
    start();
    press("Show me");
    press("Later");
    expect(card()).toBeNull();
    expect(stored().seen).toEqual([]);
  });

  it("Skip tour ends it for good", () => {
    start();
    press("Show me");
    press("Skip tour");
    expect(stored().seen).toEqual(["welcome", "tour-first-chart"]);
  });

  it("numbers the steps", () => {
    start();
    press("Show me");
    expect(card()!.querySelector(".tut-progress")!.textContent).toBe(
      `Step 1 of ${TOUR_STEPS.length - 1}`,
    );
  });
});

describe("Help and tips", () => {
  const menuButton = (id: string) => document.querySelector<HTMLButtonElement>(`#${id}`)!;

  it("replays the tour, turns tips off and on, and resets them", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: ["welcome"], off: false }));
    start();
    expect(card()).toBeNull();
    document.getElementById("pmHelpBtn")!.click();
    menuButton("tutToggleBtn").click();
    expect(stored().off).toBe(true);
    expect(menuButton("tutToggleBtn").textContent?.trim()).toBe("Turn tips on");
    menuButton("tutResetBtn").click();
    expect(stored().seen).toEqual([]);
    menuButton("tutTourBtn").click();
    expect(stored().off).toBe(false);
    expect(document.getElementById("tadOverlay")).toBeNull();
    expect(title()).toBe("Pick a deck");
  });

  it("shows no welcome while tips are off", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: [], off: true }));
    start();
    expect(card()).toBeNull();
  });
});

describe("state", () => {
  it("reads damaged storage safely", () => {
    expect(parseTips("not json")).toEqual({ seen: [], off: false });
    expect(parseTips('{"seen":["a",3],"off":"yes"}')).toEqual({ seen: ["a"], off: false });
    expect(shouldWelcome({ seen: [], off: false }, true)).toBe(false);
    expect(markSeen(markSeen({ seen: [], off: false }, "a"), "a").seen).toEqual(["a"]);
  });
});

describe("staying on the control", () => {
  it("outlines buttons themselves, the tools step their row, and shows real icons", () => {
    start();
    press("Show me");
    expect(document.getElementById("sampleBtn")!.classList.contains("tut-target")).toBe(true);
    expect(document.getElementById("toolRow")!.classList.contains("tut-target")).toBe(false);
    emit("chart:done", undefined);
    while (title() !== "Deck tools") press("Next");
    expect(document.getElementById("toolRow")!.classList.contains("tut-target")).toBe(true);
    const icon = card()!.querySelector('.tut-icon[data-from="#viewDeckBtn"] svg')!;
    expect(icon).not.toBeNull();
    expect(icon.id).toBe(""); // a copy, not the page's own element
    expect(document.getElementById("vdIcon")!.closest("#pmTutorial")).toBeNull();
  });

  it("scrolls to the control again once the page's own scrolling settles", async () => {
    vi.useFakeTimers();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    start();
    press("Show me");
    expect(scroll).toHaveBeenCalledTimes(1);
    // The page scrolled elsewhere (e.g. to new results): the control is now off screen.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: -500,
      bottom: -450,
      height: 50,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: -500,
      toJSON() {},
    } as DOMRect);
    await vi.advanceTimersByTimeAsync(500);
    expect(scroll).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("moves the card to the top when the control is in the lower half", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: window.innerHeight - 60,
      bottom: window.innerHeight - 20,
      height: 40,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON() {},
    } as DOMRect);
    start();
    press("Show me");
    expect(document.getElementById("pmTutorial")!.classList.contains("tut-top")).toBe(true);
  });
});
