import type { CardRecord } from "../cards/tuple.ts";

/** Commander Spellbook snapshot: names, outcome labels and combo rows. */
export interface SpellbookSnapshot {
  /** Card names; rows refer to them by index. */
  n: string[];
  /** Outcome labels; rows refer to them by index. */
  o: string[];
  /** [cardIdx[], code, outcomeIdx, popLog]; code = class (2 win, 1 warp, 0 value) + 4 if infinite. */
  c: SpellbookRow[];
}

export type SpellbookRow = [cards: number[], code: number, outcome: number, popularity: number];

export interface SpellbookIndex {
  snap: SpellbookSnapshot;
  nameIdx: Map<string, number>;
  byCard: (number[] | undefined)[];
}

/** One Playgroup.gg commander win-rate record. */
export interface CommanderTierRecord {
  /** Commander name. */
  n: string;
  /** Tier letter. */
  t: string;
  /** Win rate, percent. */
  w: number;
  /** Tracked games. */
  g: number;
  /** Rank. */
  r: number;
}

export interface EngineInputs {
  /** The full card database (the app's `CARD_DB`). */
  cards: readonly CardRecord[];
  /** Spellbook index, or null when the snapshot is unavailable (curated combos only). */
  spellbook: SpellbookIndex | null;
  /** Commander win-rate records; null only when they were never loaded. */
  winRates: readonly CommanderTierRecord[] | null | undefined;
}

/** Everything the engine reads besides the deck itself. Pass it explicitly; it is never global. */
export interface EngineContext extends EngineInputs {
  /** First card with this exact name. */
  cardByName(name: string): CardRecord | undefined;
  /** Commander name (and front face of a two-faced name) to win-rate record. */
  commanderTierIndex(): Map<string, CommanderTierRecord>;
}

/** Builds a context. Lookup maps are built on first use and cached on this context only. */
export function createEngineContext(inputs: EngineInputs): EngineContext {
  let byName: Map<string, CardRecord> | null = null;
  let tierIndex: Map<string, CommanderTierRecord> | null = null;
  return {
    ...inputs,
    cardByName(name) {
      if (!byName) {
        byName = new Map();
        for (const c of inputs.cards) if (!byName.has(c.n)) byName.set(c.n, c);
      }
      return byName.get(name);
    },
    commanderTierIndex() {
      if (tierIndex) return tierIndex;
      const idx = new Map<string, CommanderTierRecord>();
      // Missing win-rate data throws here, as the inline engine did.
      for (const rec of inputs.winRates as readonly CommanderTierRecord[]) {
        idx.set(rec.n, rec);
        if (rec.n.includes(" // ")) {
          const front = rec.n.split(" // ")[0] as string;
          if (!idx.has(front)) idx.set(front, rec);
        }
      }
      tierIndex = idx;
      return idx;
    },
  };
}
