// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";
import { findPodmateDeck } from "../../services/cloud/decks.ts";
import { on } from "../../services/events.ts";
import { configurePublicProfileRuntime, type PublicProfileRuntime } from "./public-runtime.ts";
import { openDeckPreviewOverlay } from "./deck-preview.ts";
import type { PublicProfileAnalysis } from "./public-types.ts";

vi.mock("../../services/cloud/decks.ts", () => ({ findPodmateDeck: vi.fn() }));

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
