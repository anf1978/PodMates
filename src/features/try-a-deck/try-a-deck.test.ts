// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { back, decksAt, initialNavigation, navigate, type SampleDeck } from "./state";
import { showTryADeck } from "./index";
import { closeAllModals } from "../../ui/modal";

afterEach(() => {
  closeAllModals();
  document.body.replaceChildren();
});

it("returns through nested release navigation without mutating earlier state", () => {
  const home = initialNavigation();
  const years = navigate(home, { view: "year-list" });
  const sets = navigate(years, { view: "set-list", year: 2011 });
  const decks = navigate(sets, { view: "set-decks", year: 2011, setName: "Commander" });
  expect(back(decks)).toEqual(sets);
  expect(back(back(back(decks)))).toEqual(home);
  expect(back(home)).toBe(home);
  expect(home.history).toEqual([]);
});

it("filters precons by both year and set without including curated namesakes", () => {
  const deck: SampleDeck = {
    key: "one",
    source: "precon",
    year: 2011,
    setName: "Commander",
    style: "Naya",
    archetype: "Voltron",
    flavorName: "Example",
    tagline: "",
    commander: "Uril, the Miststalker",
    decklist: "1 Sol Ring",
  };
  expect(
    decksAt([deck, { ...deck, year: 2012 }, { ...deck, source: "curated" }], {
      view: "set-decks",
      year: 2011,
      setName: "Commander",
    }),
  ).toEqual([deck]);
});

it("does not render a completed library into a newer dialog after the first closes", async () => {
  let release!: (decks: SampleDeck[]) => void;
  const pending = new Promise<SampleDeck[]>((resolve) => {
    release = resolve;
  });
  const first = showTryADeck({ load: () => pending, select: () => {} });
  const original = document.getElementById("tadOverlay");
  await showTryADeck({ load: async () => [], select: () => {} });
  const replacement = document.getElementById("tadOverlay");
  release([]);
  await first;
  expect(original?.isConnected).toBe(false);
  expect(document.getElementById("tadOverlay")).toBe(replacement);
  expect(replacement?.textContent).toContain("Browse by Archetype");
});
