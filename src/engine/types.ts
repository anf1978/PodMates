import type { CardRecord } from "../cards/tuple.ts";

export type { CuratedCombo } from "../data/combos.ts";

/** One decklist line handed to the engine (`MatchedCard` satisfies this). */
export interface DeckEntry {
  qty: number;
  card: CardRecord;
}

export const CARD_TAGS = [
  "ramp",
  "fastMana",
  "fastManaExtended",
  "draw",
  "removal",
  "wipe",
  "manaDork",
  "manaRock",
  "extraLand",
  "manaEnchantment",
  "treasureRamp",
  "ritual",
  "manaMultiplier",
  "untapper",
  "costReducer",
  "sacrificeMana",
  "landEngine",
  "castTriggerPayoff",
  "creatureEventPayoff",
  "protection",
  "counterMagic",
  "stax",
  "discard",
  "mld",
  "extraTurn",
  "tutor",
  "sac",
  "reanimate",
  "punisher",
  "altWin",
  "millSelf",
  "millOpponent",
  "burnFace",
  "infect",
  "aristocrats",
  "sacOutlet",
  "tokens",
  "artifactsMatter",
  "spellslinger",
  "graveyard",
  "lifegain",
  "drain",
  "landfall",
  "counters",
  "blink",
  "engine",
  "landBuffing",
  "minusCounters",
  "impulseDraw",
  "exileMatters",
  "freeInteraction",
  "cheapInteraction",
  "expensiveInteraction",
] as const;

export type CardTag = (typeof CARD_TAGS)[number];
export type CardTags = Record<CardTag, boolean>;

/** What `classifyCard` reads off one card. */
export interface CardTraits extends CardTags {
  isLand: boolean;
  isCreature: boolean;
  isInstant: boolean;
  isSorcery: boolean;
  isPermanent: boolean;
  cmc: number;
  gameChanger: boolean;
  banned: boolean;
  name: string;
}

/**
 * Reads a trait by a name that may not be a tag at all (the synergy themes include
 * "artifacts", which no card carries): unknown names are simply false.
 */
export function hasTrait(c: CardTraits, key: string): boolean {
  return Boolean((c as unknown as Record<string, unknown>)[key]);
}

export interface ComboDetail {
  cards: string[];
  outcome: string | null;
  infinite: boolean;
  bracketRelevant: boolean;
  winsAlone: boolean;
  commanderPiece: boolean;
  redundancy: number;
  reliability: number;
  totalCastCost: number;
  pieceCosts: number[];
  pieceCount: number;
  matchedNames: string[];
  source?: "spellbook";
  comboClass?: "win" | "warp";
}

export interface TwoCardLoop {
  name: string;
  cards: string[];
  pieceCosts: number[];
}

export interface NearMissLine {
  held: string[];
  outcome: string | null;
  win: boolean;
  inf: boolean;
  len: number;
  cmdr: boolean;
  source: "spellbook" | "curated";
  rank: number;
}

export interface NearMissGroup {
  missing: string;
  mv: number;
  count: number;
  lines: NearMissLine[];
  best: number;
}

export interface ManaCurveContributor {
  cmc: number;
  output: number;
  isMultiplier: boolean;
  isCommander: boolean;
}

export interface ManaCurvePoint {
  turn: number;
  mana: number;
}

export interface WinCondition {
  label: string;
  detail: string;
  confidence: "high" | "medium" | "fallback";
  cards?: string[];
}

/** The parts of an app-side archetype match the engine reads. */
export interface ArchetypeMatch {
  top?: { deck: { archetype?: string | null } } | null;
}

export interface SynergyEdge {
  a: string;
  b: string;
  score: number;
  reasons: string[];
}

export interface ThemeScore {
  theme: string;
  count: number;
  density: number;
}
