// Source-window, pagination/cache and missing-rarity contract coverage.
import { beforeEach, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("../../services/scryfall", () => ({ fetchScryfallJson: request }));
import { enrichRarities, signalCards } from "./data";

beforeEach(() => {
  request.mockReset();
});
it("deduplicates recent signals by the shared vote key without mutating source order", () => {
  const index = Math.round((Date.parse("2026-11-11") - Date.UTC(2020, 0, 1)) / 86400000);
  const signals = [
    { type: "new_card", n: "Test Relic", day: index - 10, set: "old" },
    { type: "new_card", n: "TEST RELIC", day: index, setName: "new" },
    { type: "new_card", n: "Too Old", day: index - 11 },
    { type: "reprint", n: "Reprint", day: index },
  ];
  const original = structuredClone(signals);
  const cards = signalCards(signals, "2026-11-11");
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({
    key: "test-relic",
    n: "TEST RELIC",
    setName: "new",
    date: "2026-11-11",
  });
  expect(cards[0].img).toContain("exact=TEST%20RELIC&format=image&version=normal");
  expect(signals).toEqual(original);
});
it("bounds Scryfall to three pages, checks freshness/front faces, deduplicates and caches", async () => {
  vi.resetModules();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-11"));
  const card = {
    name: "Relic",
    released_at: "2026-11-01",
    rarity: "rare",
    card_faces: [{ image_uris: { normal: "front", small: "thumb" } }],
  };
  request.mockResolvedValue({
    data: [card, { ...card, name: "Old", released_at: "2026-10-31" }],
    has_more: true,
    next_page: "https://api.scryfall.com/next",
  });
  try {
    const { fetchSpoilers } = await import("./data");
    expect(await fetchSpoilers()).toMatchObject([{ key: "relic", img: "front", thumb: "thumb" }]);
    expect(request).toHaveBeenCalledTimes(3);
    await fetchSpoilers();
    expect(request).toHaveBeenCalledTimes(3);
  } finally {
    vi.restoreAllMocks();
  }
});
it("enriches only missing rarities in batches of 75 and matches split-card front names", async () => {
  const cards = Array.from({ length: 76 }, (_, i) => ({
    key: String(i),
    n: `Card ${i}`,
    setName: "",
    rarity: "",
  }));
  cards[0].n = "Front // Back";
  request
    .mockResolvedValueOnce({ data: [{ name: "Front", rarity: "rare" }] })
    .mockResolvedValueOnce({ data: [{ name: "Card 75", rarity: "bonus" }] });
  await enrichRarities(cards);
  expect(request).toHaveBeenCalledTimes(2);
  const batches = request.mock.calls.map((call) => JSON.parse(call[1].body).identifiers.length);
  expect(batches).toEqual([75, 1]);
  expect(cards[0].rarity).toBe("rare");
  expect(cards[75].rarity).toBe("bonus");
  expect(cards[1].rarity).toBe("");
});
