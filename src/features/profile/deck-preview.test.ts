// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";
import { findPodmateDeck } from "../../services/cloud/decks.ts";
import { on } from "../../services/events.ts";
import { configurePublicProfileRuntime, type PublicProfileRuntime } from "./public-runtime.ts";
import { openDeckPreviewOverlay, openSamplePreviewOverlay } from "./deck-preview.ts";
import type { PublicProfileAnalysis } from "./public-types.ts";

vi.mock("../../services/cloud/decks.ts", () => ({ findPodmateDeck: vi.fn() }));
const library = vi.hoisted(() => ({ decks: [] as Record<string, unknown>[], load: vi.fn() }));
vi.mock("../../services/card-data.ts", () => ({
  loadDeckLibrary: library.load,
  deckLibrary: () => library.decks,
}));

const request = { uid: "friend", name: "Alex", podId: "pod", deckName: "Atraxa (Alex)" };
let modal: HTMLElement;
let runtime: PublicProfileRuntime;
const analysis = (): PublicProfileAnalysis =>
  ({
    agg: {},
    name: "Atraxa (Alex)",
    commanderLabel: "Atraxa, Praetors' Voice",
    commanders: ["Atraxa, Praetors' Voice"],
    style: "Value Midrange",
    pace: 6,
    scores: { speed: 5.25, consistency: 6, versatility: 7.5, disruption: 4, powerLevel: 6.75 },
    bracket: { bracketKey: "3", bracket: "3 (Upgraded)" },
    commandSpark: 6.04,
    totalCards: 100,
  }) as unknown as PublicProfileAnalysis;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const text = () => modal.textContent?.replace(/\s+/g, " ") || "";

beforeEach(() => {
  vi.resetAllMocks();
  modal = document.createElement("div");
  document.body.replaceChildren(modal);
  runtime = {
    isDbReady: () => true,
    getIndexes: () => null,
    loadSavedDecks: () => ({}),
    dropLinkedDuplicates: (decks) => decks,
    analyzeOneList: vi.fn(() => analysis()),
    fetchCardImageUrl: vi.fn(async () => null),
    openTadOverlay: () => ({ modal }),
    closeTryADeckModal: vi.fn(),
    showActionConfirmModal: vi.fn(),
    chartDeck: vi.fn(),
    podColors: [],
  };
  configurePublicProfileRuntime(runtime);
});

it("shows the deck's stats, then charts it on request", async () => {
  vi.mocked(findPodmateDeck).mockResolvedValue({
    key: "Atraxa (Alex)",
    deckName: "Atraxa (Alex)",
    list: "1 Sol Ring",
    commander: "Atraxa, Praetors' Voice",
    player: "Alex",
    savedAt: 1,
    secret: false,
    docId: "d1",
  });
  await openDeckPreviewOverlay(request);
  expect(findPodmateDeck).toHaveBeenCalledWith("friend", "Atraxa (Alex)");
  expect(runtime.analyzeOneList).toHaveBeenCalledWith(
    "1 Sol Ring",
    "Alex",
    "Atraxa, Praetors' Voice",
  );
  expect(text()).toContain("Atraxa (Alex)");
  expect(text()).toContain("by Alex");
  const pairs = (selector: string) =>
    [...modal.querySelectorAll(selector)].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()),
    );
  expect(pairs(".pp-deck-stats > div")).toEqual([
    ["Command Spark", "6.0"],
    ["Bracket", "3 (Upgraded)"],
    ["Style", "Value Midrange"],
    ["Cards", "100"],
  ]);
  expect(pairs(".pp-deck-axes li")).toEqual([
    ["Speed", "5.3"],
    ["Consistency", "6.0"],
    ["Versatility", "7.5"],
    ["Disruption", "4.0"],
    ["Power Level", "6.8"],
  ]);
  modal.querySelector<HTMLButtonElement>("#deckPreviewChartBtn")!.click();
  expect(runtime.closeTryADeckModal).toHaveBeenCalled();
  expect(runtime.chartDeck).toHaveBeenCalledWith(
    expect.objectContaining({
      _ownerUid: "friend",
      _ownerName: "Alex",
      _rawList: "1 Sol Ring",
      _rawCommander: "Atraxa, Praetors' Voice",
    }),
  );
});

it("explains a deck that is no longer shared and offers the player's profile", async () => {
  vi.mocked(findPodmateDeck).mockResolvedValue(null);
  const player = vi.fn();
  const off = on("profile:player", player);
  await openDeckPreviewOverlay(request);
  expect(text()).toContain("isn't shared any more");
  expect(runtime.chartDeck).not.toHaveBeenCalled();
  modal.querySelector<HTMLButtonElement>("#deckPreviewProfileBtn")!.click();
  expect(player).toHaveBeenCalledWith({ uid: "friend", name: "Alex", podId: "pod" });
  off();
});

it("waits for the card database and reports load failures", async () => {
  runtime.isDbReady = () => false;
  await openDeckPreviewOverlay(request);
  expect(text()).toContain("Card database still loading");
  expect(findPodmateDeck).not.toHaveBeenCalled();
  runtime.isDbReady = () => true;
  vi.mocked(findPodmateDeck).mockRejectedValue(new Error("offline"));
  await openDeckPreviewOverlay(request);
  await settle();
  expect(text()).toContain("Couldn't load this deck");
});

it("previews a deck newly added to Try a Deck and charts it", async () => {
  library.load.mockResolvedValue(undefined);
  library.decks = [
    {
      key: "cmd2027-new",
      flavorName: "Brand New",
      tagline: "Go wide <fast>.",
      commander: "Atraxa, Praetors' Voice",
      decklist: "1 Sol Ring",
    },
  ];
  await openSamplePreviewOverlay({ key: "cmd2027-new" });
  expect(library.load).toHaveBeenCalled();
  expect(runtime.analyzeOneList).toHaveBeenCalledWith("1 Sol Ring", "", "Atraxa, Praetors' Voice");
  expect(modal.querySelector(".pp-player-name")?.textContent).toBe("Brand New");
  expect(modal.querySelector(".pp-player-count")?.textContent).toBe("Go wide <fast>.");
  modal.querySelector<HTMLButtonElement>("#deckPreviewChartBtn")!.click();
  expect(runtime.chartDeck).toHaveBeenCalledWith(
    expect.objectContaining({ _rawList: "1 Sol Ring", _ownerName: "", _ownerUid: null }),
  );
});

it("says so when the Try-a-Deck deck is not available", async () => {
  library.load.mockResolvedValue(undefined);
  library.decks = [];
  await openSamplePreviewOverlay({ key: "gone" });
  expect(text()).toContain("isn't in Try a Deck right now");
  expect(modal.querySelector("#deckPreviewProfileBtn")).toBeNull();
});
