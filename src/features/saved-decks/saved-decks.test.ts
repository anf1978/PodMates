// Save Deck and Load a Deck against the typed repositories (mocked), through the page's form.
// @vitest-environment happy-dom
import { beforeAll, beforeEach, expect, it, vi } from "vitest";

const cloud = vi.hoisted(() => ({
  decks: {} as Record<string, Record<string, unknown>>,
  podmates: {} as Record<string, Record<string, unknown>>,
  saveDeck: vi.fn(),
  setSeatDeck: vi.fn(async () => {}),
}));
vi.mock("../../services/cloud/session", () => ({
  getCurrentUser: () => ({ uid: "me" }),
  isCloudReady: () => true,
  onAuthChange: () => {},
}));
vi.mock("../../services/cloud/decks", () => ({
  loadAllDecks: async () => structuredClone(cloud.decks),
  loadPodmateDecksRaw: async (uid: string) => structuredClone(cloud.podmates[uid] ?? {}),
  saveDeck: cloud.saveDeck,
  deleteDeck: vi.fn(),
  setDeckSecret: vi.fn(),
}));
vi.mock("../../services/cloud/pods", () => ({ loadMyPods: async () => [{ id: "p" }] }));
vi.mock("../../services/cloud/members", () => ({
  loadPodMembers: async () => [{ uid: "me" }, { uid: "u2", displayLabel: "Bo" }],
}));
vi.mock("../../services/cloud/gatherings", () => ({ setSeatDeck: cloud.setSeatDeck }));
vi.mock("../../services/cloud/linked-decks", () => ({ addLinkedDeck: vi.fn() }));
vi.mock("../../services/report-error", () => ({
  reportOperation: (fn: unknown) => fn,
  reportError: vi.fn(),
}));

import { mount } from "./index";
import { showLoadDeckModal } from "./load-deck";
import { emit } from "../../services/events";
import type { DeckPickTarget } from "../../services/saved-decks";

const nameChosen = vi.fn();
const value = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)!.value;
const rows = () =>
  [...document.querySelectorAll(".load-deck-row")].map((r) =>
    r.textContent!.replace(/\s+/g, " ").trim(),
  );
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeAll(() => {
  mount({
    ready: () => true,
    analyze: () => null,
    requireAccount: () => true,
    nameChosen,
    importedUrl: () => null,
  });
});
beforeEach(() => {
  document.body.innerHTML = `
    <textarea id="decklistInput"></textarea><input id="commanderInput"><input id="playerInput">
    <input id="deckNameInput"><input type="checkbox" id="deckSecretCheckbox">
    <div id="deckMgmtStatus"></div><button id="chartBtn"></button>`;
  cloud.decks = {
    Talrand: {
      list: "1 Island",
      commander: "Talrand",
      player: "Al",
      deckName: "Talrand",
      savedAt: 2,
    },
    Omnath: { list: "1 Forest", commander: "Omnath", player: "Al", deckName: "Omnath", savedAt: 1 },
  };
  cloud.podmates = {
    u2: { Kenrith: { list: "1 Plains", commander: "Kenrith", player: "x", savedAt: 3 } },
  };
  cloud.saveDeck.mockReset().mockResolvedValue(undefined);
});

async function openLoadDeck(target?: DeckPickTarget) {
  if (target) emit("decks:pick", target);
  else void showLoadDeckModal();
  await vi.waitFor(() => expect(document.querySelector(".load-deck-row")).not.toBeNull());
}

it("lists my decks and podmates' shared ones, filters, and loads one into the form", async () => {
  await openLoadDeck();
  expect(rows()).toEqual([
    expect.stringMatching(/^Kenrith Bo/),
    expect.stringMatching(/^Talrand Al.*🔓 ×$/),
    expect.stringMatching(/^Omnath Al/),
  ]);
  const search = document.querySelector<HTMLInputElement>("#loadDeckSearch")!;
  search.value = "omn";
  search.dispatchEvent(new Event("input"));
  expect(rows()).toHaveLength(1);
  search.value = "";
  search.dispatchEvent(new Event("input"));
  document.querySelector<HTMLElement>("[data-load-player='Bo']")!.click();
  expect(rows()).toEqual([expect.stringMatching(/^Kenrith Bo/)]);
  document.querySelector<HTMLElement>("[data-load-player='Bo']")!.click();
  expect(rows()).toHaveLength(3);

  document.querySelector<HTMLElement>("[data-load-deck-key='Talrand']")!.click();
  expect(document.querySelector(".tad-overlay")).toBeNull();
  expect([value("decklistInput"), value("commanderInput"), value("playerInput")]).toEqual([
    "1 Island",
    "Talrand",
    "Al",
  ]);
  expect(value("deckNameInput")).toBe("Talrand");
  expect(nameChosen).toHaveBeenCalled();
  expect(document.querySelector("#deckMgmtStatus")!.textContent).toBe("Loaded “Talrand”.");
});

it("puts a picked deck into a Gathering seat, pre-filtered to that podmate", async () => {
  await openLoadDeck({
    gatheringSeat: {
      podId: "p",
      gatheringId: "g",
      seatIndex: 1,
      seatUid: "u2",
      seatIsGuest: false,
      seatDisplayName: "Bo",
    },
  });
  expect(document.querySelector("h2")!.textContent).toBe("Load a Deck — Seat 2 (Bo)");
  expect(rows()).toEqual([expect.stringMatching(/^Kenrith Bo/)]);
  document.querySelector<HTMLElement>("[data-load-deck-key='pm:u2:Kenrith']")!.click();
  expect(cloud.setSeatDeck).toHaveBeenCalledWith("p", "g", 1, {
    commander: "Kenrith",
    list: "1 Plains",
    cardCount: null,
  });
});

it("asks before reusing a deck name and can save under a fresh one", async () => {
  await openLoadDeck(); // fills the cache
  document.querySelector<HTMLElement>("#tadCloseBtn")!.click();
  Object.assign(document.querySelector<HTMLTextAreaElement>("#decklistInput")!, {
    value: "1 Island",
  });
  Object.assign(document.querySelector<HTMLInputElement>("#commanderInput")!, { value: "Talrand" });
  Object.assign(document.querySelector<HTMLInputElement>("#playerInput")!, { value: "Al" });
  Object.assign(document.querySelector<HTMLInputElement>("#deckNameInput")!, { value: "Talrand" });
  emit("decks:save", undefined);
  expect(document.querySelector(".tad-sub")!.textContent!.trim()).toBe(
    'A deck named "Talrand" already exists. Overwrite it, or save this as a separate, new deck?',
  );
  document.querySelector<HTMLElement>("#dnSaveNewBtn")!.click();
  expect(value("deckNameInput")).toBe("Talrand (2)");
  await settle();
  expect(cloud.saveDeck).toHaveBeenCalledWith(
    "Talrand (2)",
    expect.objectContaining({
      list: "1 Island",
      commander: "Talrand",
      player: "Al",
      secret: false,
    }),
    undefined,
  );
});

it("explains what is missing before saving", () => {
  emit("decks:save", undefined);
  expect(document.querySelector("#deckMgmtStatus")!.textContent).toBe(
    "Paste a decklist before saving.",
  );
  expect(cloud.saveDeck).not.toHaveBeenCalled();
});
