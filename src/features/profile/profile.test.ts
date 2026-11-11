// Unified profile decks preserve stable mirror identity, recency and source metadata.
import { describe, expect, it } from "vitest";
import { mergeDecks, signInMethod } from "./state";
import type { LinkedDeckDoc, SavedDeck, WithId } from "../../services/cloud/types";

function saved(docId: string, overrides: Partial<SavedDeck> = {}): SavedDeck {
  return {
    docId,
    list: "1 Sol Ring\n\n1 Plains",
    commander: "Commander",
    player: "Alex",
    deckName: "Deck",
    savedAt: 20,
    secret: false,
    ...overrides,
  };
}
function linked(overrides: Partial<WithId<LinkedDeckDoc>> = {}): WithId<LinkedDeckDoc> {
  return {
    id: "moxfield-123",
    platform: "moxfield",
    deckId: "123",
    url: "https://moxfield.com/decks/123",
    name: "Renamed deck",
    commander: "Commander",
    decklistText: "1 Sol Ring",
    cardCount: 1,
    addedAt: 10,
    syncedAt: 15,
    ...overrides,
  };
}

describe("profile deck normalization", () => {
  it("pairs a renamed linked mirror by document id rather than display name", () => {
    const result = mergeDecks({ "Old label": saved("linked-moxfield-123") }, [linked()]);
    expect(result.backfill).toEqual([]);
    expect(result.decks).toEqual([
      expect.objectContaining({
        id: "saved:Old label",
        name: "Old label",
        rawKey: "Old label",
        rawId: "moxfield-123",
        source: "moxfield",
        isLinked: true,
        cardCount: 2,
      }),
    ]);
  });

  it("keeps a manual deck with the same label and backfills only unmatched linked ids", () => {
    const imported = linked({ name: "Shared name", addedAt: 30 });
    const result = mergeDecks({ "Shared name": saved("manual") }, [imported]);
    expect(result.backfill).toEqual([imported]);
    expect(result.decks.map(({ source }) => source)).toEqual(["moxfield", "saved"]);
    expect(result.decks[1]).toMatchObject({ rawId: null, isLinked: false, url: null });
  });

  it("uses sync time when an older linked deck has no added time", () => {
    const result = mergeDecks({}, [linked({ addedAt: undefined, syncedAt: 42 })]);
    expect(result.decks[0]).toMatchObject({ addedAt: 42, cardCount: 1 });
    expect(signInMethod(["password", "google.com", "yahoo.com"])).toBe(
      "email and password and Google and Yahoo",
    );
    expect(signInMethod([])).toBe("email");
  });
});
