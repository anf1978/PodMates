// Gallery grouping for View Deck: exactly one bucket per card, so an image never appears twice and
// each heading's count matches the deck. (The engine's typeFrequency deliberately credits an
// Artifact Creature to both buckets; a gallery cannot.) Order is priority, most specific first.
import type { CardRecord } from "../../cards/tuple";

export const VIEWER_CATEGORY_ORDER = [
  "Planeswalker",
  "Battle",
  "Creature",
  "Sorcery",
  "Instant",
  "Artifact",
  "Enchantment",
  "Land",
] as const;

export type ViewerGroupName = "Commander" | (typeof VIEWER_CATEGORY_ORDER)[number] | "Other";

export const VIEWER_GROUP_ORDER: readonly ViewerGroupName[] = [
  "Commander",
  ...VIEWER_CATEGORY_ORDER,
  "Other",
];

export function viewerCategory(typeLine: string | undefined): ViewerGroupName {
  const prefix = (typeLine || "").split("—")[0];
  return VIEWER_CATEGORY_ORDER.find((category) => prefix.includes(category)) ?? "Other";
}

export interface ViewerTile {
  name: string;
  qty: number;
}

export interface ViewerGroup {
  name: ViewerGroupName;
  count: number;
  tiles: ViewerTile[];
}

export interface DeckGallery {
  /** Every distinct card name, in deck order. */
  names: string[];
  /** Non-empty groups in display order, cards sorted by name. */
  groups: ViewerGroup[];
}

/** Merges repeated lines of one card, then groups commanders first and the rest by card type. */
export function groupDeck(
  matched: readonly { qty: number; card: Pick<CardRecord, "n" | "t"> }[],
  commanderNames: ReadonlySet<string>,
): DeckGallery {
  const totals = new Map<string, number>();
  const buckets = new Map<ViewerGroupName, string[]>();
  for (const { qty, card } of matched) {
    if (totals.has(card.n)) {
      totals.set(card.n, (totals.get(card.n) ?? 0) + qty);
      continue;
    }
    totals.set(card.n, qty);
    const bucket = commanderNames.has(card.n) ? "Commander" : viewerCategory(card.t);
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), card.n]);
  }
  const groups = VIEWER_GROUP_ORDER.flatMap((name) => {
    const names = buckets.get(name);
    if (!names) return [];
    const tiles = [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((n) => ({ name: n, qty: totals.get(n) ?? 0 }));
    return [{ name, count: tiles.reduce((sum, t) => sum + t.qty, 0), tiles }];
  });
  return { names: [...totals.keys()], groups };
}

/** Sums repeated entries of the same card, sorted by name, for one Card Type Frequency row. */
export function typeTiles(entries: readonly ViewerTile[]): ViewerTile[] {
  const totals = new Map<string, number>();
  for (const e of entries) totals.set(e.name, (totals.get(e.name) ?? 0) + e.qty);
  return [...totals.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, qty: totals.get(name) ?? 0 }));
}
