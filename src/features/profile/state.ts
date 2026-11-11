// Normalize saved and linked decks without depending on their editable display labels.
import type { LinkedDeckDoc, SavedDeck, WithId } from "../../services/cloud/types";

export interface ProfileDeck {
  id: string;
  source: string;
  rawKey: string;
  rawId: string | null;
  name: string;
  commander: string;
  player: string;
  decklistText: string;
  cardCount: number;
  url: string | null;
  isLinked: boolean;
  addedAt: number;
}

export function mergeDecks(
  saved: Record<string, SavedDeck>,
  linked: Array<WithId<LinkedDeckDoc>>,
): { decks: ProfileDeck[]; backfill: Array<WithId<LinkedDeckDoc>> } {
  const byId = new Map(linked.map((deck) => [deck.id, deck]));
  const claimed = new Set<string>();
  const decks: ProfileDeck[] = Object.entries(saved).map(([key, entry]) => {
    const mirror = entry.docId?.startsWith("linked-") ? byId.get(entry.docId.slice(7)) : undefined;
    if (mirror) claimed.add(mirror.id);
    const list = entry.list || "";
    return {
      id: `saved:${key}`,
      source: mirror ? mirror.platform : "saved",
      rawKey: key,
      rawId: mirror?.id || null,
      name: key,
      commander: entry.commander || "",
      player: entry.player || "",
      decklistText: list,
      cardCount: list
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean).length,
      url: mirror?.url || null,
      isLinked: Boolean(mirror),
      addedAt: entry.savedAt || 0,
    };
  });
  const backfill = linked.filter((deck) => !claimed.has(deck.id));
  for (const deck of backfill)
    decks.push({
      id: `saved:${deck.name}`,
      source: deck.platform,
      rawKey: deck.name,
      rawId: deck.id,
      name: deck.name,
      commander: deck.commander || "",
      player: "",
      decklistText: deck.decklistText,
      cardCount: deck.cardCount,
      url: deck.url,
      isLinked: true,
      addedAt: deck.addedAt || deck.syncedAt || 0,
    });
  decks.sort((a, b) => b.addedAt - a.addedAt);
  return { decks, backfill };
}

export function signInMethod(providers: string[]): string {
  return (
    [
      providers.includes("password") ? "email and password" : "",
      providers.includes("google.com") ? "Google" : "",
      providers.includes("yahoo.com") ? "Yahoo" : "",
    ]
      .filter(Boolean)
      .join(" and ") || "email"
  );
}
