// Shapes shared by the interaction-package reading ("Card Links & Packages") and the
// "Cards you could add" suggestions. Display only: nothing here feeds a score.

import type { CardRecord } from "../../../cards/tuple.ts";
import type { MatchedCard } from "../../../cards/lookup.ts";

/** Scryfall Tagger function tags the reading uses (lower-case front-face names). */
export interface InteractionTags {
  blink: ReadonlySet<string>;
  extraCombat: ReadonlySet<string>;
}

/** The page data the reading needs besides the deck: the card database and the tags. */
export interface InteractionData {
  cards: readonly CardRecord[];
  tags: InteractionTags;
}

/** [list id, list length, date, kind: role|theme|enabler|staple|budget|precon]. */
export type KnowList = [id: string, length: number, date: string, kind: string];
/** [list index, tier 3|2|1, is a commander row, rank]. */
export type KnowEntry = [list: number, tier: number, commanderRow: unknown, rank?: number];
/** [score, entries, reason in own words, index of the list the reason comes from, ...]. */
export type KnowCard = [score: number, entries: KnowEntry[], reason: string, reasonList: number];

/** KNOW_JSON: card knowledge from ranked community lists, built by know-build.cjs. */
export interface KnowledgeJson {
  lists: KnowList[];
  cards: Record<string, KnowCard>;
}

/** The loaded knowledge plus its lower-case name index. */
export interface Knowledge {
  json: KnowledgeJson;
  byName: ReadonlyMap<string, KnowCard>;
}

/** What a trigger or rule watches for, read from a phrase such as "another Elf". */
export interface IxFilter {
  self: boolean;
  types: string[];
  kws: string[];
  subs: string[];
  /** true: tokens only; false: nontoken only; null: either. */
  token: boolean | null;
  other: boolean;
  label: string;
  generic?: boolean;
}

/** The loose filter carried by packages that were not read from a phrase. */
export type IxFilterLike = Partial<IxFilter> & { label: string };

/** A token a card makes. */
export interface IxToken {
  creature: boolean;
  artifact: boolean;
  kws: string[];
  desc: string;
}

/** A deck card as the reading sees it. */
export interface IxEntry extends Partial<MatchedCard> {
  card: CardRecord;
  text: string;
  isCmd: boolean;
  tokens: IxToken[];
  /** Front and back face text, memoised by the planeswalker plan. */
  ft?: string;
}

/** A commander looked up by name when it is not among the matched cards. */
export type IxCommanderEntry = Pick<IxEntry, "card" | "text" | "isCmd">;

export interface IxLink {
  name: string;
  how: string;
}

export interface IxMember {
  name: string;
  effect: string;
  w?: number;
  isCmd?: boolean;
}

export type IxKind = "trigger" | "rule" | "group" | "pool" | "plan";

export interface IxPackage {
  kind: IxKind;
  payoff: string;
  isCmd: boolean;
  event?: string;
  phrase?: string;
  /** Prebuilt heading markup; card names are wrapped in link slots (see `linkSlot`). */
  head?: string;
  rule?: boolean;
  filter: IxFilterLike;
  effect: string;
  objects: string[];
  objCount: number;
  tokenMakers: string[];
  repeaters: IxLink[];
  multipliers: IxLink[];
  members?: IxMember[];
  extraLines?: string[];
  fodderLabel?: string;
  finishers?: IxLink[];
  backups?: IxLink[];
  statLine?: string;
  score: number;
}

export interface IxConditional {
  name: string;
  why: string;
}

export interface InteractionReading {
  packages: IxPackage[];
  idle: string[];
  conditional: IxConditional[];
  axis: string | null;
  nonlandCount: number;
}

/** A suggested card. */
export interface IxPick {
  n: string;
  m: number;
  why: string;
  g: boolean;
  w?: number;
  bonus?: number;
  rk?: number;
  r?: number;
  p?: number;
}

export interface IxPickGroup {
  label: string;
  list: IxPick[];
}

export interface IxSuggestion {
  title: string;
  sub: string;
  groups: IxPickGroup[];
  tag?: string;
  dim?: boolean;
  sig?: string;
}

/** Deck roles the thin-spot check reads (counts from the deck analysis). */
export interface IxRoleCounts {
  ramp?: number | undefined;
  draw?: number | undefined;
  removal?: number | undefined;
}

/** What the Synergy panel keeps so the suggestions sheet can be opened later. */
export interface SuggestionContext {
  matched: MatchedCard[];
  commanders: string[];
  packages: IxPackage[];
  axis: string | null;
  roles: IxRoleCounts;
}
