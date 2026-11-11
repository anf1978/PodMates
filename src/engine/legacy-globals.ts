// The page's engine context. The card database, Spellbook index and commander win-rates are
// still classic-script globals owned by index.html (`var CARD_DB`, `var SPELLBOOK_INDEX`,
// `let COMMANDER_TIER_DATA`), filled by the inline card-DB boot adapter; typed callers get an
// EngineContext built from them here instead of reading globals. No engine names are published
// on window any more. Delete this file when the boot adapter moves and owns the data itself.

import type { CardRecord } from "../cards/tuple.ts";
import { createEngineContext } from "./context.ts";
import type { CommanderTierRecord, EngineContext, SpellbookIndex } from "./context.ts";

// Read only through `typeof` so an unset one is just empty.
declare const CARD_DB: CardRecord[] | undefined;
declare const SPELLBOOK_INDEX: SpellbookIndex | null | undefined;
declare const COMMANDER_TIER_DATA: CommanderTierRecord[] | undefined;

let cached: { key: readonly unknown[]; ctx: EngineContext } | null = null;

/** The context for the page's current data; rebuilt only when one of the globals is replaced. */
export function pageContext(): EngineContext {
  const cards = typeof CARD_DB !== "undefined" && CARD_DB ? CARD_DB : [];
  const spellbook = typeof SPELLBOOK_INDEX !== "undefined" ? SPELLBOOK_INDEX || null : null;
  const winRates = typeof COMMANDER_TIER_DATA !== "undefined" ? COMMANDER_TIER_DATA : undefined;
  const key = [cards, spellbook, winRates] as const;
  if (!cached || cached.key.some((v, i) => v !== key[i])) {
    cached = { key, ctx: createEngineContext({ cards, spellbook, winRates }) };
  }
  return cached.ctx;
}
