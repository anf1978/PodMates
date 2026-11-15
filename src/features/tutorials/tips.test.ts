// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emit } from "../../services/events";
import { mount, type TutorialsFeature } from "./index";
import { parseTips, STORAGE_KEY } from "./state";
import { TOUR_STEPS } from "./state";
import { findTip, TIPS } from "./tips";

vi.mock("../../services/report-error", () => ({ reportError: vi.fn() }));

let feature: TutorialsFeature | undefined;
const host = () => document.getElementById("pmTutorial")!;
const title = () => host().querySelector(".tut-title")?.textContent?.trim();
const press = (label: string) =>
  [...host().querySelectorAll("button")].find((b) => b.textContent?.trim() === label)!.click();
const stored = () => parseTips(localStorage.getItem(STORAGE_KEY));
const settle = async () => {
  await vi.advanceTimersByTimeAsync(60);
};

/** A stand-in dialog holding headings given as [className, text]. */
function openDialog(...headings: [string, string][]): HTMLElement {
  const overlay = document.createElement("div");
  overlay.id = "tadOverlay";
  for (const [className, text] of headings) {
    const h2 = document.createElement("h2");
    h2.className = className;
    h2.textContent = text;
    overlay.append(h2);
  }
  document.body.append(overlay);
  return overlay;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  // Welcome already seen: these tests are about the tips.
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: ["welcome"], off: false }));
  document.body.innerHTML = `<div id="authBar"></div><textarea id="decklistInput"></textarea>
    <input id="deckLinkInput" /><button id="deckLinkLoadBtn">Load</button>
    <button id="loadDeckBtn">Load a Deck</button>`;
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    return ((this as HTMLElement).style.display === "none" ? [] : [{}]) as unknown as DOMRectList;
  });
});

afterEach(() => {
  feature?.destroy();
  feature = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const start = () => (feature = mount(document.getElementById("authBar")!));

describe("first-use tips", () => {
  it("explains a field the first time it gets focus, once", () => {
    start();
    document
      .getElementById("decklistInput")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(title()).toBe("Paste a decklist");
    press("Got it");
    expect(stored().seen).toContain("tip-paste");
    document
      .getElementById("decklistInput")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(title()).toBeUndefined();
  });

  it("outlines the tip's target while it shows", () => {
    start();
    document
      .getElementById("deckLinkInput")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(title()).toBe("Import a deck");
    expect(document.getElementById("deckLinkLoadBtn")!.classList.contains("tut-target")).toBe(true);
    press("Got it");
    expect(document.querySelectorAll(".tut-target")).toHaveLength(0);
  });

  it("shows a dialog's tip on top of it, and closes it (as seen) with the dialog", async () => {
    start();
    const dialog = openDialog(["cv-title", "View Deck"]);
    await settle();
    expect(title()).toBe("View Deck");
    expect(host().hidden).toBe(false);
    expect(host().classList.contains("tut-over")).toBe(true);
    dialog.remove();
    await settle();
    expect(title()).toBeUndefined();
    expect(stored().seen).toContain("tip-view-deck");
    openDialog(["cv-title", "View Deck"]);
    await settle();
    expect(title()).toBeUndefined();
  });

  it("shows the after-save tip on the save event", () => {
    start();
    emit("decks:saved", { name: "Atraxa" });
    expect(title()).toBe("Saved");
    expect(document.getElementById("loadDeckBtn")!.classList.contains("tut-target")).toBe(true);
  });

  it("No more tips switches them all off", () => {
    start();
    emit("decks:saved", { name: "Atraxa" });
    press("No more tips");
    expect(stored().off).toBe(true);
    document
      .getElementById("decklistInput")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(title()).toBeUndefined();
  });

  it("waits while the welcome card or the tour is up", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: [], off: false }));
    start();
    expect(title()).toBe("Welcome to PodMates");
    document
      .getElementById("decklistInput")!
      .dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(title()).toBe("Welcome to PodMates");
    press("Show me");
    emit("decks:saved", { name: "x" });
    expect(title()).toBe("Pick a deck");
  });

  it("Escape closes a tip as seen", () => {
    start();
    emit("decks:saved", { name: "Atraxa" });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(title()).toBeUndefined();
    expect(stored().seen).toContain("tip-saved");
  });
});

describe("tip list", () => {
  it("has unique ids and exactly one trigger per tip", () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length);
    for (const tip of TIPS)
      expect([tip.when, tip.focus, tip.event].filter(Boolean), tip.id).toHaveLength(1);
  });

  it("skips tips already seen", () => {
    openDialog(["export-title", "Export"], ["cv-title", "View Deck"]);
    expect(findTip([])?.tip.id).toBe("tip-export");
    expect(findTip(["tip-export"])?.tip.id).toBe("tip-view-deck");
  });
});

describe("tip markers", () => {
  it("every class and id a tip relies on still exists in the app's markup", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = process.cwd(); // vitest runs from the repository root
    const features = join(root, "src", "features");
    const files = readdirSync(features, { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith(".ts") && !f.startsWith("tutorials") && !f.endsWith(".test.ts"))
      .map((f) => readFileSync(join(features, f), "utf8"));
    const source = [...files, readFileSync(join(root, "index.html"), "utf8")].join("\n");
    // Tour steps' targets and icons are checked the same way.
    const tourChecks = TOUR_STEPS.map((step) => ({
      id: step.id,
      when: step.target ?? undefined,
      icons: step.icons,
    }));
    for (const tip of [...TIPS, ...tourChecks] as Array<{
      id: string;
      when?: string;
      focus?: string;
      target?: string;
      icons?: { from: string }[];
    }>) {
      const icons = (tip.icons ?? []).map((icon) => icon.from);
      for (const selector of [tip.when, tip.focus, tip.target, ...icons].filter(
        Boolean,
      ) as string[]) {
        for (const token of selector.match(/[.#][\w-]+/g) ?? []) {
          const name = token.slice(1);
          const pattern =
            token[0] === "#"
              ? new RegExp(`id=["'\`]${name}["'\`]|\\.id = "${name}"`)
              : new RegExp(`class=["'\`][^"'\`]*\\b${name}\\b`);
          expect(pattern.test(source), `${tip.id}: ${token}`).toBe(true);
        }
      }
    }
  });
});
