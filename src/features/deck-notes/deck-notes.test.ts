// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "../../ui/html";
import { closeAllModals } from "../../ui/modal";
import type { DeckNotesDoc } from "../../services/cloud/types";
import { deckNotesExtras, type DeckNotesExtras } from "./index";
import { notesBundle } from "./state";

const cloud = vi.hoisted(() => ({
  notes: null as DeckNotesDoc | null,
  loadDeckNotes: vi.fn(),
  saveCardNote: vi.fn(),
  saveDeckPrimer: vi.fn(),
  loadSparkChecks: vi.fn(async () => []),
}));
vi.mock("../../services/cloud/deck-notes", () => ({
  NOTE_ROLES: ["ramp", "draw", "removal", "protection", "wincon", "combo", "synergy"],
  loadDeckNotes: cloud.loadDeckNotes,
  saveCardNote: cloud.saveCardNote,
  saveDeckPrimer: cloud.saveDeckPrimer,
  loadSparkChecks: cloud.loadSparkChecks,
}));
vi.mock("../../services/report-error", () => ({ reportError: vi.fn() }));

const base = (): DeckNotesDoc => ({
  primer: "",
  cards: { "Sol Ring": { roles: ["ramp"], text: "Fast mana", at: 1 } },
  shareForTuning: false,
  updatedAt: 1,
});
const deck = { uid: "ann", id: "d1" };
const target = { deckName: "Ann's deck", commander: "Atraxa", list: "1 Sol Ring\n1 Opt" };
let root: HTMLElement;

/** Draws the header and two cards, as View Deck would, and redraws on request. */
function show(extras: DeckNotesExtras) {
  const draw = () =>
    render(
      [extras.header(), ...["Sol Ring", "Opt"].map((n) => [n, extras.tile(n)])] as unknown,
      root,
    );
  extras.attach(draw, ["Sol Ring", "Opt"]);
  draw();
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim() === label,
  );

beforeEach(() => {
  document.body.innerHTML = `<div id="root"></div>`;
  root = document.getElementById("root")!;
  cloud.loadDeckNotes.mockImplementation(async () => base());
  cloud.saveCardNote.mockImplementation(async (_ref, name, note) => {
    const next = base();
    if (note) next.cards[name] = { ...note, at: 2 };
    else delete next.cards[name];
    return next;
  });
  cloud.saveDeckPrimer.mockImplementation(async (_ref, primer, share) => ({
    ...base(),
    primer,
    shareForTuning: share,
  }));
});
afterEach(() => {
  closeAllModals();
  vi.clearAllMocks();
});

describe("deck notes in View Deck", () => {
  it("lets the owner add a card note with roles", async () => {
    show(deckNotesExtras({ ...target, ref: deck, me: "ann" }));
    await settle();
    expect(root.textContent).toContain("Write a primer");
    expect(root.querySelector(".dn-owner-hint")).not.toBeNull();
    expect(button("Note for Sol Ring")?.classList.contains("dn-has")).toBe(true);
    button("Add a note for Opt")!.click();
    button("Draw")!.click();
    expect(button("Draw")!.getAttribute("aria-pressed")).toBe("true");
    document.querySelector<HTMLTextAreaElement>("#dnNoteText")!.value = "Smooths draws";
    button("Save note")!.click();
    await settle();
    expect(cloud.saveCardNote).toHaveBeenCalledWith(deck, "Opt", {
      roles: ["draw"],
      text: "Smooths draws",
    });
    expect(document.getElementById("tadNoteOverlay")).toBeNull();
    expect(button("Note for Opt")?.classList.contains("dn-has")).toBe(true);
  });

  it("saves the primer and the tuning choice", async () => {
    show(deckNotesExtras({ ...target, ref: deck, me: "ann" }));
    await settle();
    button("Write a primer")!.click();
    document.querySelector<HTMLTextAreaElement>("#dnPrimerText")!.value = "Go wide.";
    document.querySelector<HTMLInputElement>("#dnShareTuning")!.checked = true;
    button("Save primer")!.click();
    await settle();
    expect(cloud.saveDeckPrimer).toHaveBeenCalledWith(deck, "Go wide.", true);
    expect(root.querySelector(".dn-primer-text")?.textContent).toBe("Go wide.");
    expect(root.textContent).toContain("Edit primer");
  });

  it("shows podmates only the notes, read-only", async () => {
    show(deckNotesExtras({ ...target, ref: deck, me: "bob" }));
    await settle();
    expect(root.textContent).not.toContain("Write a primer");
    expect(button("Add a note for Opt")).toBeUndefined();
    button("Note for Sol Ring")!.click();
    expect(document.querySelector("#tadNoteOverlay")?.textContent).toContain("Fast mana");
    expect(document.querySelector("#dnNoteText")).toBeNull();
  });

  it("asks to save a pasted deck first, and shows nothing when signed out", async () => {
    show(deckNotesExtras({ ...target, ref: null, me: "ann" }));
    expect(root.textContent).toContain("Save this deck to add a primer and card notes.");
    expect(cloud.loadDeckNotes).not.toHaveBeenCalled();
    show(deckNotesExtras({ ...target, ref: deck, me: null }));
    expect(root.querySelector(".dn-hint, .dn-head, .dn-note-btn")).toBeNull();
  });

  it("lists notes on cards that left the deck", async () => {
    cloud.loadDeckNotes.mockImplementation(async () => ({
      ...base(),
      cards: { ...base().cards, "Mana Crypt": { roles: [], text: "Cut for budget", at: 1 } },
    }));
    show(deckNotesExtras({ ...target, ref: deck, me: "ann" }));
    await settle();
    expect(root.querySelector(".dn-removed summary")?.textContent).toBe(
      "Notes on cards no longer in the deck (1)",
    );
  });
});

describe("the copied text", () => {
  it("holds the decklist, primer, card notes and Spark checks", () => {
    const text = notesBundle({
      deckName: "Ann's deck",
      commander: "Atraxa",
      list: "1 Sol Ring\n1 Opt\n",
      notes: {
        ...base(),
        primer: "Go wide.",
        shareForTuning: true,
        cards: {
          ...base().cards,
          Opt: { roles: ["draw", "combo"], text: "Line one\nline two", at: 1 },
          "Mana Crypt": { roles: [], text: "Cut", at: 1 },
        },
      },
      checks: [{ verdict: "right", spark: 6.4, at: Date.UTC(2026, 10, 20), podId: "p" }],
      order: ["Opt", "Sol Ring"],
    });
    expect(text).toBe(
      [
        "PodMates deck notes: Ann's deck",
        "Commander: Atraxa",
        "Shared to help tune Spark: yes",
        "",
        "== Decklist ==",
        "1 Sol Ring\n1 Opt",
        "",
        "== Primer ==",
        "Go wide.",
        "",
        "== Card notes ==",
        "- Opt [Draw, Combo piece]: Line one / line two",
        "- Sol Ring [Ramp]: Fast mana",
        "",
        "== Notes on cards no longer in the deck ==",
        "- Mana Crypt: Cut",
        "",
        "== After-battle Spark checks ==",
        "- 2026-11-20: About right (Spark 6.4)",
        "",
      ].join("\n"),
    );
  });
});
