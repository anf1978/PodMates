// Shared decklist-to-analysis boundary for comparison, profiles and saved-deck tables.
import { parseDecklist } from "../cards/parse-decklist";
import { matchDecklist, type LookupIndexes, type MatchedCard } from "../cards/lookup";
import {
  analyzeDeck,
  detectWinCondition,
  parseCommanderField,
  scoreSpeed,
  scoreConsistency,
  scoreVersatility,
  scoreDisruption,
  scorePowerLevel,
  type EngineContext,
} from "../engine";
import { computeSpark } from "../engine/spark";
import { computePace, detectTableFeel } from "../engine/table-feel";
import { detectBracket } from "../engine/brackets";
import { lookupCommanderTiers } from "../engine/commander-tiers";

export const POD_COLORS = ["#E0B24D", "#8AB1E0", "#8FBF78", "#E0977A", "#C9A0DC", "#7EC8C8"];
export interface AnalysisInput {
  context: EngineContext;
  indexes: LookupIndexes;
  detectCommander(matched: MatchedCard[], parsed: string[]): string[];
}
export type ComparisonDeck = NonNullable<ReturnType<typeof analyzeList>> & {
  color?: string;
  uid?: string | null;
};

export function analyzeList(
  raw: string,
  playerName: string,
  commanderOverride: string,
  input: AnalysisInput,
) {
  const parsed = parseDecklist(raw);
  if (!parsed.entries.length) return null;
  const { matched, notFound } = matchDecklist(
    parsed.entries,
    [...input.context.cards],
    input.indexes,
  );
  if (!matched.length) return null;
  const commanders = commanderOverride?.trim()
    ? parseCommanderField(input.context, commanderOverride)
    : input.detectCommander(matched, parsed.commanderNames);
  const agg = { ...analyzeDeck(input.context, matched, commanders), commanders };
  const winCons = detectWinCondition(agg);
  const speed = scoreSpeed(agg, winCons.length > 0 && winCons[0].confidence !== "fallback");
  const consistency = scoreConsistency(agg);
  const versatility = scoreVersatility(agg, winCons.length);
  const disruption = scoreDisruption(agg);
  const powerLevel = scorePowerLevel(agg);
  const commandSpark = computeSpark(speed, consistency, versatility, disruption, powerLevel);
  let style = "Midrange";
  if (agg.detectedCombos.length > 0) style = "Combo";
  else if ((agg.stax || 0) >= 6) style = "Stax / Control";
  else if ((agg.themes.aristocrats || 0) >= 8) style = "Drain / Aristocrats";
  else if (speed >= 7 && (agg.earlyDensity || 0) > 0.45) style = "Turbo / Fast";
  else if ((agg.engineRatio || 0) > 0.18) style = "Engine Midrange";
  else if (agg.altWinCards.length > 0) style = "Alt-Win Toolbox";
  else if (agg.ramp + agg.draw >= 18) style = "Value Midrange";
  const commanderLabel = commanders.length ? commanders.join(" / ") : "Unknown Commander";
  return {
    name: playerName?.trim() ? `${commanderLabel} (${playerName.trim()})` : commanderLabel,
    playerName: (playerName || "").trim(),
    commanders,
    commanderLabel,
    agg,
    winCons,
    scores: { speed, consistency, versatility, disruption, powerLevel },
    pace: computePace(speed, winCons),
    commandSpark,
    bracket: detectBracket(agg, commandSpark),
    tableFeel: detectTableFeel(agg, powerLevel, disruption, winCons),
    style,
    commanderTiers: lookupCommanderTiers(input.context, commanders),
    matchedCount: matched.length,
    totalCards: agg.totalCards,
    notFoundCount: notFound.length,
  };
}
