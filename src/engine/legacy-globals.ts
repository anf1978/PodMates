// Strangler shim: publishes the engine on `window` under exactly the names the inline
// legacy scripts in index.html still call, with their old signatures. Functions that now
// take an EngineContext get one built from the page's CARD_DB, SPELLBOOK_INDEX and
// COMMANDER_TIER_DATA globals. Add no behaviour here; delete it with the last caller.

import type { CardRecord } from "../cards/tuple.ts";
import { DEFAULT_IMPACT_CARDS } from "../data/impact-defaults.ts";
import { GAME_CHANGER_REASONS } from "../data/game-changers.ts";
import { analyzeDeck } from "./analyze.ts";
import {
  IMPACT_PTS_CAP,
  IMPACT_PTS_PER_CARD,
  impactCardsInDeck,
  scorePowerLevel,
} from "./axes/power-level.ts";
import { scoreConsistency } from "./axes/consistency.ts";
import { scoreDisruption } from "./axes/disruption.ts";
import { computeManaCurve } from "./axes/shared.ts";
import { scoreSpeed } from "./axes/speed.ts";
import { scoreVersatility } from "./axes/versatility.ts";
import { EARLY_COMBO_BY_TURN, detectBracket, earliestComboTurn } from "./brackets.ts";
import { classifyCard } from "./classify.ts";
import { COMBO_FINISH, COMBO_NEEDS_PAYOFF, comboDisplayWin, comboKind } from "./combo-outcomes.ts";
import { buildSpellbookIndex, comboCardByName } from "./combos.ts";
import { CENTRALITY_KEYWORDS, centralityPluralForms } from "./centrality-fed.ts";
import { CENTRALITY_BANDS, CENTRALITY_WEIGHTS, COMMANDER_RULES } from "./centrality-rules.ts";
import { computeCommanderCentrality } from "./centrality.ts";
import { IXPROP } from "./commander-ability.ts";
import { detectCommanderSparkDiscrepancy, lookupCommanderTiers } from "./commander-tiers.ts";
import { parseCommanderField } from "./commanders.ts";
import { createEngineContext } from "./context.ts";
import type { CommanderTierRecord, EngineContext, SpellbookIndex } from "./context.ts";
import { ixUsable } from "./legality.ts";
import { SPARK_WEIGHTS, computeSpark } from "./spark.ts";
import { TABLE_VIBE_ARCHETYPES, computePace, detectTableFeel } from "./table-feel.ts";
import { detectWinCondition } from "./win-condition.ts";

// Classic-script globals owned by index.html (`var CARD_DB`, `var SPELLBOOK_INDEX`,
// `let COMMANDER_TIER_DATA`); read only through `typeof` so an unset one is just empty.
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

/** The legacy signature: the same function without its leading context argument. */
function withPageContext<A extends unknown[], R>(
  fn: (ctx: EngineContext, ...args: A) => R,
): (...args: A) => R {
  return (...args) => fn(pageContext(), ...args);
}

const legacy = {
  CENTRALITY_BANDS,
  CENTRALITY_KEYWORDS,
  CENTRALITY_WEIGHTS,
  COMBO_FINISH,
  COMBO_NEEDS_PAYOFF,
  COMMANDER_RULES,
  DEFAULT_IMPACT_CARDS,
  EARLY_COMBO_BY_TURN,
  GAME_CHANGER_REASONS,
  IMPACT_PTS_CAP,
  IMPACT_PTS_PER_CARD,
  IXPROP,
  SPARK_WEIGHTS,
  TABLE_VIBE_ARCHETYPES,
  buildSpellbookIndex,
  centralityPluralForms,
  classifyCard,
  comboDisplayWin,
  comboKind,
  computeManaCurve,
  computePace,
  computeSpark,
  detectBracket,
  detectCommanderSparkDiscrepancy,
  detectTableFeel,
  detectWinCondition,
  earliestComboTurn,
  impactCardsInDeck,
  ixUsable,
  scoreConsistency,
  scoreDisruption,
  scorePowerLevel,
  scoreSpeed,
  scoreVersatility,
  analyzeDeck: withPageContext(analyzeDeck),
  comboCardByName: (name: string): CardRecord | null =>
    comboCardByName(pageContext(), name) ?? null,
  computeCommanderCentrality: withPageContext(computeCommanderCentrality),
  lookupCommanderTiers: withPageContext(lookupCommanderTiers),
  parseCommanderField: withPageContext(parseCommanderField),
};

type LegacyEngine = typeof legacy;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends LegacyEngine {}
}

Object.assign(window, legacy);
