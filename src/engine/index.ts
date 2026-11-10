// Public engine API. Everything here is pure: pass an EngineContext for any card,
// Spellbook or win-rate data.
export { createEngineContext } from "./context.ts";
export type {
  CommanderTierRecord,
  EngineContext,
  EngineInputs,
  SpellbookIndex,
  SpellbookSnapshot,
} from "./context.ts";
export { analyzeDeck } from "./analyze.ts";
export type { DeckAnalysis, DeckTallies } from "./analyze-tallies.ts";
export { buildSpellbookIndex } from "./combos.ts";
export { parseCommanderField, resolveCommanderName } from "./commanders.ts";
export { detectWinCondition } from "./win-condition.ts";
export { scoreSpeed } from "./axes/speed.ts";
export { scoreConsistency } from "./axes/consistency.ts";
export { scoreVersatility } from "./axes/versatility.ts";
export { scoreDisruption } from "./axes/disruption.ts";
export { scorePowerLevel } from "./axes/power-level.ts";
