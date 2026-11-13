import { expect, it } from "vitest";
import { recentlyAdded } from "./card-data";

it("keeps decks added within the window, ignoring undated, bad and future dates", () => {
  const now = Date.parse("2026-12-01T12:00:00Z");
  const decks = [
    { key: "today", addedAt: "2026-12-01" },
    { key: "edge", addedAt: "2026-11-02" },
    { key: "old", addedAt: "2026-10-01" },
    { key: "future", addedAt: "2026-12-25" },
    { key: "undated" },
    { key: "bad", addedAt: "soon" },
    { key: "number", addedAt: 5 },
  ];
  expect(recentlyAdded(decks, now, 30).map((d) => d.key)).toEqual(["today", "edge"]);
});
