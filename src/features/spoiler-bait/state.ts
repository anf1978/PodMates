// Pure Spoiler Bait queue, votes and pod-board ordering; no DOM or cloud access.
import type { SpoilerVoteDoc } from "../../services/cloud/types";

export const WINDOW_DAYS = 10;
export const RARITIES = [
  ["common", "Common"],
  ["uncommon", "Uncommon"],
  ["rare", "Rare"],
  ["mythic", "Mythic"],
  ["special", "Special"],
] as const;
export type Vote = SpoilerVoteDoc["vote"];
export type Tab = "swipe" | "liked" | "binned" | "board";
export interface SpoilerCard {
  key: string;
  n: string;
  rarity?: string;
  setName: string;
  date?: string;
  via?: string;
  img?: string;
  thumb?: string;
}
export interface PodVotes {
  name: string;
  votes: SpoilerVoteDoc[];
}
export interface SpoilerState {
  cards: SpoilerCard[];
  votes: Map<string, SpoilerVoteDoc>;
  undo: string[];
  rarities: Set<string>;
  tab: Tab;
  busy: boolean;
}
export interface BoardRow {
  key: string;
  n: string;
  likes: string[];
  passes: string[];
  last: number;
}

export function createState(rarities: Iterable<string> = RARITIES.map(([key]) => key)): SpoilerState {
  return {
    cards: [],
    votes: new Map(),
    undo: [],
    rarities: new Set(rarities),
    tab: "swipe",
    busy: false,
  };
}
export function cardKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}
export function rarityOf(card: SpoilerCard): string {
  const rarity = (card.rarity || "").toLowerCase();
  return rarity === "bonus" ? "special" : rarity;
}
export function unsorted(state: SpoilerState): SpoilerCard[] {
  return state.cards.filter((card) => !state.votes.has(card.key));
}
export function queue(state: SpoilerState): SpoilerCard[] {
  return unsorted(state).filter((card) => !rarityOf(card) || state.rarities.has(rarityOf(card)));
}
export function setVote(
  state: SpoilerState,
  card: SpoilerCard,
  vote: Vote,
  now: number,
): void {
  state.votes.set(card.key, {
    key: card.key, n: card.n, setName: card.setName || "", vote, votedAt: now,
  });
}
export function boardRows(members: PodVotes[]): BoardRow[] {
  const byCard = new Map<string, BoardRow>();
  for (const member of members) for (const vote of member.votes) {
    let row = byCard.get(vote.key);
    if (!row) {
      row = { key: vote.key, n: vote.n, likes: [], passes: [], last: 0 };
      byCard.set(vote.key, row);
    }
    (vote.vote === "like" ? row.likes : row.passes).push(member.name);
    row.last = Math.max(row.last, vote.votedAt || 0);
  }
  return [...byCard.values()].sort((a, b) =>
    b.likes.length - a.likes.length || a.passes.length - b.passes.length || b.last - a.last);
}
