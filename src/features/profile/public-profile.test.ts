// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeDeck } from "../../engine/analyze.ts";
import { createEngineContext } from "../../engine/context.ts";
import { buildLookupIndexes } from "../../cards/lookup.ts";
import type { CardRecord } from "../../cards/tuple.ts";
import { loadPodmateDecks } from "../../services/cloud/decks.ts";
import { loadPodMembers } from "../../services/cloud/members.ts";
import { loadAllChronicles } from "../../services/cloud/chronicles.ts";
import {
  assignPlayerColors,
  computeProfileBracketDistribution,
  computeProfileColorBreakdown,
  computeProfileTypeBreakdown,
  computeProfileVibeTrait,
  primaryTypeTotalsForDeck,
} from "./public-analytics.ts";
import {
  analyzeDecksForProfile,
  computeMostUsedCommander,
  getPlayerRawDecksForProfile,
  getPodRawDecksForProfile,
} from "./public-data.ts";
import { configurePublicProfileRuntime, type PublicProfileRuntime } from "./public-runtime.ts";
import { openPodProfileOverlay, renderPlayerProfileContent } from "./public-view.ts";
import type { PublicProfileAnalysis, PublicProfileDeck } from "./public-types.ts";
import type { ChronicleDoc } from "../../services/cloud/types.ts";

const session = vi.hoisted(() => ({ uid: "me" as string | null }));
vi.mock("../../services/cloud/session.ts", () => ({
  getCurrentUser: () => (session.uid ? { uid: session.uid } : null),
}));
vi.mock("../../services/cloud/decks.ts", () => ({ loadPodmateDecks: vi.fn() }));
vi.mock("../../services/cloud/members.ts", () => ({ loadPodMembers: vi.fn() }));
vi.mock("../../services/cloud/chronicles.ts", () => ({ loadAllChronicles: vi.fn() }));

function analysis(overrides: Partial<PublicProfileAnalysis> = {}): PublicProfileAnalysis {
  return {
    agg: analyzeDeck(createEngineContext({ cards: [], spellbook: null, winRates: [] }), []),
    name: "Commander",
    commanderLabel: "Commander",
    commanders: ["Commander"],
    style: "Midrange",
    pace: 5,
    scores: { disruption: 4 },
    ...overrides,
  };
}

function card(name: string, ci: string): CardRecord {
  return {
    n: name,
    ci,
    t: "Legendary Creature",
    o: "",
    c: "",
    m: 1,
    p: "",
    r: "rare",
    g: false,
    b: false,
  };
}

function chronicle(decks: unknown[]): ChronicleDoc & { id: string } {
  return {
    id: "battle",
    decks,
    date: "",
    notes: "",
    createdAt: 0,
    loggedBy: "me",
    gatheringId: null,
    gatheringTitle: null,
    participants: [],
    feedbackResponses: [],
  };
}

function member(uid: string, displayName: string, nameClash = false) {
  return {
    uid,
    displayName,
    displayLabel: displayName,
    nameClash,
    role: "member" as const,
    joinedAt: 0,
  };
}

let saved: Record<string, PublicProfileDeck>;
let runtime: PublicProfileRuntime;
let modal: HTMLElement;

beforeEach(() => {
  vi.resetAllMocks();
  session.uid = "me";
  saved = {};
  modal = document.createElement("div");
  document.body.replaceChildren(modal);
  runtime = {
    isDbReady: () => true,
    getIndexes: () => buildLookupIndexes([]),
    loadSavedDecks: () => saved,
    dropLinkedDuplicates: (decks) => decks,
    analyzeOneList: vi.fn(() => analysis()),
    fetchCardImageUrl: vi.fn(async () => null),
    openTadOverlay: () => ({ modal }),
    closeTryADeckModal: vi.fn(),
    showActionConfirmModal: vi.fn(),
    chartDeck: vi.fn(),
    podColors: ["red", "blue"],
  };
  configurePublicProfileRuntime(runtime);
  vi.mocked(loadAllChronicles).mockResolvedValue([]);
  vi.mocked(loadPodMembers).mockResolvedValue([]);
  vi.mocked(loadPodmateDecks).mockResolvedValue({});
});

describe("public profile collection analytics", () => {
  it("counts multi-type cards once, with quantity, so pie shares sum to 100%", () => {
    const deck = analysis();
    deck.agg.cardsByType = {
      Creature: [{ name: "Artifact Creature", qty: 2 }],
      Artifact: [
        { name: "Artifact Creature", qty: 2 },
        { name: "Ring", qty: 1 },
      ],
      Land: [{ name: "Forest", qty: 3 }],
    };
    expect(primaryTypeTotalsForDeck(deck.agg)).toEqual({ Creature: 2, Artifact: 1, Land: 3 });
    const result = computeProfileTypeBreakdown([deck]);
    expect(result.map((entry) => entry.type)).toEqual(["Land", "Creature", "Artifact"]);
    expect(result.reduce((sum, entry) => sum + entry.pct, 0)).toBeCloseTo(100);
  });

  it("uses colored pips and colorless nonland cards, not literal colorless pips", () => {
    const deck = analysis();
    deck.agg.manaPipsRequired = { W: 6, U: 2, C: 99 };
    deck.agg.colorlessNonlandCount = 2;
    expect(computeProfileColorBreakdown([deck])).toEqual([
      { color: "W", pct: 60 },
      { color: "U", pct: 20 },
      { color: "C", pct: 20 },
    ]);
    expect(computeProfileColorBreakdown([])).toEqual([]);
    expect(computeProfileTypeBreakdown([])).toEqual([]);
  });

  it("splits hybrid traits and removes parenthetical labels before choosing a majority", () => {
    const voltron = analysis();
    voltron.agg.equipmentCount = 8;
    const mill = analysis();
    mill.agg.millOpponentCount = 4;
    expect(computeProfileVibeTrait([voltron, mill, mill])).toBe("Johnny");
    expect(computeProfileVibeTrait([voltron])).toBe("Timmy");
    expect(computeProfileVibeTrait([analysis()])).toBeNull();
  });

  it("groups only inferred brackets in their stable order, never inferring cEDH", () => {
    expect(
      computeProfileBracketDistribution([
        { bracket: { bracketKey: "4" } },
        { bracket: { bracketKey: "3" } },
        { bracket: { bracketKey: "1-2" } },
        { bracket: { bracketKey: "3" } },
        { bracket: { bracketKey: "5" } },
        {},
      ]),
    ).toEqual([
      { key: "1-2", label: "1–2 (Exhibition / Core)", count: 1 },
      { key: "3", label: "3 (Upgraded)", count: 2 },
      { key: "4", label: "4 (Optimized)", count: 1 },
    ]);
  });

  it("keeps repeated owners one color but disambiguates accounts sharing a name", () => {
    const result = assignPlayerColors(
      [
        { _ownerUid: "a", _ownerName: "Alex" },
        { _ownerUid: "a", _ownerName: "Alex" },
        { _ownerUid: "b", _ownerName: "Alex" },
        { _ownerUid: "c", _ownerName: "Sam" },
      ],
      ["red", "blue"],
    );
    expect(result.colorMap).toEqual({ a: "red", b: "blue", c: "red" });
    expect(result.owners).toHaveLength(3);
  });
});

describe("public profile data boundaries", () => {
  it("excludes own secret decks from analytics and preserves the source list and owner", async () => {
    saved = {
      shared: { list: "1 Shared", commander: "Commander", player: "Old label" },
      hidden: { list: "1 Secret", commander: "Hidden", secret: true },
    };
    const raw = await getPlayerRawDecksForProfile("me");
    expect(raw).toHaveLength(1);
    const result = analyzeDecksForProfile([
      { ...raw[0], _ownerUid: "me", _ownerName: "Real name" },
    ]);
    expect(result[0]).toMatchObject({
      _rawList: "1 Shared",
      _rawCommander: "Commander",
      _ownerUid: "me",
      _ownerName: "Real name",
    });
    expect(runtime.analyzeOneList).toHaveBeenCalledOnce();
    expect(loadPodmateDecks).not.toHaveBeenCalled();
  });

  it("attributes pod decks to real member records rather than free-text saved labels", async () => {
    saved = { one: { list: "1 Card", commander: "Commander", player: "Someone else" } };
    vi.mocked(loadPodMembers).mockResolvedValue([
      member("me", "Real name"),
      member("other", "Other"),
    ]);
    vi.mocked(loadPodmateDecks).mockRejectedValue(new Error("not shared"));
    expect(await getPodRawDecksForProfile("pod")).toEqual([
      { ...saved.one, _ownerUid: "me", _ownerName: "Real name" },
    ]);
    vi.mocked(loadPodMembers).mockRejectedValue(new Error("unavailable"));
    expect(await getPodRawDecksForProfile("pod")).toEqual([]);
  });

  it("matches logged accounts despite renamed players, rejecting ambiguous historical names", async () => {
    vi.mocked(loadPodMembers).mockResolvedValue([member("me", "Alex", true)]);
    vi.mocked(loadAllChronicles).mockResolvedValue([
      chronicle([
        { uid: "me", player: "Old Alex", commander: "Mine" },
        { uid: "other", player: "Alex", commander: "Theirs" },
        { player: "Alex", commander: "Theirs" },
        { player: "Alex", commander: "Theirs" },
      ]),
    ]);
    expect(await computeMostUsedCommander("pod", "Alex", [], null, "me")).toBe("Mine");
  });

  it("breaks battle-count ties using commander color identity and falls back to unique old names", async () => {
    runtime.getIndexes = () =>
      buildLookupIndexes([card("White commander", "W"), card("Blue commander", "U")]);
    vi.mocked(loadPodMembers).mockResolvedValue([member("me", "Alex")]);
    vi.mocked(loadAllChronicles).mockResolvedValue([
      chronicle([
        { player: "Alex", commander: "Blue commander" },
        { player: "Alex", commander: "White commander" },
      ]),
    ]);
    expect(
      await computeMostUsedCommander(
        "pod",
        "Alex",
        [
          { color: "W", pct: 80 },
          { color: "U", pct: 20 },
        ],
        null,
        "me",
      ),
    ).toBe("White commander");
    vi.mocked(loadAllChronicles).mockRejectedValue(new Error("unavailable"));
    expect(await computeMostUsedCommander("pod", "Alex", [], null, "me")).toBeNull();
  });
});

it("renders own secret-deck count without analyzing secrets or interpreting player text as markup", async () => {
  saved = {
    shared: { list: "1 Shared", commander: "Commander" },
    hidden: { list: "1 Secret", commander: "Hidden", secret: true },
  };
  await renderPlayerProfileContent(modal, "me", "<img src=x onerror=alert(1)>", null);
  expect(modal.textContent).toContain("2 decks charted (1 secret)");
  expect(modal.textContent).toContain("<img src=x onerror=alert(1)>");
  expect(modal.querySelector("img")).toBeNull();
  expect(runtime.analyzeOneList).toHaveBeenCalledOnce();
});

it("confirms a scatter selection, charts the original source, and returns to the pod on cancel", async () => {
  vi.mocked(loadPodMembers).mockResolvedValue([member("me", "Me")]);
  saved = { one: { list: "1 Original", commander: "Source commander" } };
  openPodProfileOverlay({ id: "pod", name: "My pod" });
  await vi.waitFor(() => expect(modal.querySelector("circle[data-deck-idx]")).not.toBeNull());
  modal.querySelector("circle[data-deck-idx]")!.dispatchEvent(new MouseEvent("click"));
  const [message, label, confirm, cancel] = vi.mocked(runtime.showActionConfirmModal).mock.calls[0];
  expect(message).toBe("Chart Commander? This loads it into Chart Deck.");
  expect(label).toBe("Chart Deck");
  confirm();
  expect(runtime.chartDeck).toHaveBeenCalledWith(
    expect.objectContaining({
      _rawList: "1 Original",
      _rawCommander: "Source commander",
      _ownerName: "Me",
    }),
  );
  cancel();
  await vi.waitFor(() => expect(modal.textContent).toContain("My pod"));
  modal.querySelector<HTMLButtonElement>("#tadCloseBtn")!.click();
  expect(runtime.closeTryADeckModal).toHaveBeenCalledOnce();
});
