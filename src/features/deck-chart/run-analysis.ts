// "Chart Deck": reads the form, analyses the list and paints every result panel.

import { parseDecklist } from "../../cards/parse-decklist.ts";
import { matchDecklist, type LookupIndexes } from "../../cards/lookup.ts";
import type { CardRecord } from "../../cards/tuple.ts";
import {
  analyzeDeck,
  detectCommander,
  detectWinCondition,
  parseCommanderField,
  scoreConsistency,
  scoreDisruption,
  scorePowerLevel,
  scoreSpeed,
  scoreVersatility,
} from "../../engine/index.ts";
import { detectBracket } from "../../engine/brackets.ts";
import {
  detectCommanderSparkDiscrepancy,
  lookupCommanderTiers,
} from "../../engine/commander-tiers.ts";
import { pageContext } from "../../services/card-data.ts";
import { computeSpark } from "../../engine/spark.ts";
import { detectTableFeel } from "../../engine/table-feel.ts";
import { emit } from "../../services/events.ts";
import { updateChart } from "../../services/current-chart.ts";
import {
  analysisDatasetsLoaded,
  archetypeMatch as matchArchetype,
  loadAnalysisDatasets,
  manaBaseBenchmark,
  type SampleDeck,
} from "../../services/reference-data.ts";
import { setStatusText } from "../../ui/status.ts";
import {
  chartLegality,
  renderLegality,
  renderManaBase,
  renderManaCurveChart,
  renderTypeTable,
} from "./panels/render.ts";
import * as report from "./report.ts";
import { showLegalityPopup } from "./results/notices.ts";
import {
  renderArchetypeMatch,
  renderBracket,
  renderChart,
  renderNotFound,
  renderTableFeel,
  renderWinCondition,
} from "./results/render.ts";

/** What the page supplies (src/app/deck-chart.ts): card-DB readiness, lookup indexes and the deck form. */
export interface ChartPorts {
  dbReady(): boolean;
  indexes(): LookupIndexes;
  /** A plain-English problem with the pasted list's size, or "". */
  deckListProblem(raw: string): string;
  autoFillDeckName(): void;
  /** Drops sample decks whose cards are not in this card database yet. */
  availableSampleDecks(decks: SampleDeck[]): SampleDeck[];
}

/** The data the Key Pieces and Synergy panels pull in. */
export interface ReportPorts {
  keyPieces: Parameters<typeof report.renderKeyPieces>[0];
  synergy: Parameters<typeof report.renderSynergyProfile>[0];
}

function setStatus(message: string, isError?: boolean): void {
  setStatusText(document.getElementById("status"), message, isError);
}

function resultsSection(): HTMLElement {
  return document.getElementById("resultsSection") as HTMLElement;
}

function hideResults(message: string): void {
  setStatus(message, true);
  resultsSection().style.display = "none";
}

function statusMessage(
  agg: ReturnType<typeof analyzeDeck>,
  uniqueCount: number,
  commanders: string[],
): string {
  let statusMsg = `Charted ${agg.totalCards} cards (${uniqueCount} unique) — ${agg.landCount} lands, ${agg.nonlandCount} spells.`;
  if (agg.bannedCount)
    statusMsg += ` ${agg.bannedCount} banned ${agg.bannedCount === 1 ? "card was" : "cards were"} left out of the scoring.`;
  if (commanders.length) {
    statusMsg += ` · Commander: ${commanders.join(" / ")}`;
  } else {
    statusMsg += ` · ⚠ No commander identified — type one in the Commander field (required to save)`;
  }
  if (agg.gameChangers.length) statusMsg += ` · ${agg.gameChangers.length} Game Changer(s)`;
  if (agg.detectedCombos.length) {
    const scoredSpellbook = (agg.detectedComboDetails || []).filter(
      (d) => d.source === "spellbook",
    ).length;
    statusMsg +=
      ` · ${agg.detectedCombos.length} combo line(s) counted` +
      (agg.spellbookMatched > scoredSpellbook
        ? ` (${agg.spellbookMatched - scoredSpellbook} more found, not scored)`
        : "");
  }
  return statusMsg;
}

export async function runAnalysis(ports: ChartPorts, panels: ReportPorts): Promise<void> {
  if (!ports.dbReady()) return;
  if (!analysisDatasetsLoaded()) setStatus("Loading analysis data...");
  try {
    await loadAnalysisDatasets(ports.availableSampleDecks);
  } catch (e) {
    console.error(e);
    setStatus("Could not load analysis data: " + (e as Error).message, true);
    return;
  }
  const raw = (document.getElementById("decklistInput") as HTMLTextAreaElement).value;
  const sizeProblem = ports.deckListProblem(raw);
  if (sizeProblem) return hideResults(sizeProblem);
  const parsed = parseDecklist(raw);
  if (parsed.entries.length === 0)
    return hideResults("Paste a decklist first — one card per line.");

  const ctx = pageContext();
  const cards = ctx.cards as CardRecord[];
  const { matched, notFound, fuzzyMatches } = matchDecklist(parsed.entries, cards, ports.indexes());
  if (matched.length === 0)
    return hideResults("No cards could be matched. Check the spelling and try again.");

  // Commander: prefer explicit field, then paste section, then heuristic
  const commanderInput = document.getElementById("commanderInput") as HTMLInputElement | null;
  const cmdField = (commanderInput?.value || "").trim();
  let commanders: string[];
  if (cmdField) {
    commanders = parseCommanderField(ctx, cmdField, matched);
  } else {
    commanders = detectCommander(matched, parsed.commanderNames);
    // Auto-fill the field when we detected something
    if (commanders.length && commanderInput) {
      commanderInput.value = commanders.join(" / ");
      ports.autoFillDeckName();
    }
  }
  const agg = Object.assign(analyzeDeck(ctx, matched, commanders), { commanders });
  updateChart({ matched, commanders });
  emit("chart:commanders", commanders);
  const winCons = detectWinCondition(agg);
  updateChart({ winCons });

  const hasSpecificWinCon = winCons.length > 0 && winCons[0]?.confidence !== "fallback";
  const speed = scoreSpeed(agg, hasSpecificWinCon);
  const consistency = scoreConsistency(agg);
  const versatility = scoreVersatility(agg, winCons.length);
  const disruption = scoreDisruption(agg);
  const powerLevel = scorePowerLevel(agg);
  const commandSpark = computeSpark(speed, consistency, versatility, disruption, powerLevel);

  const bracket = detectBracket(agg, commandSpark);
  const tableFeel = detectTableFeel(agg, powerLevel, disruption, winCons);
  const commanderTiers = lookupCommanderTiers(ctx, commanders);
  const archetypeMatch = matchArchetype(agg);
  const tierDiscrepancy = detectCommanderSparkDiscrepancy(
    commanderTiers,
    commandSpark,
    archetypeMatch,
  );

  const commanderCardsForBenchmark = commanders
    .map((name) => {
      const inList = matched.find((m) => m.card.n === name);
      if (inList) return inList.card;
      return ctx.cards.find((c) => c.n === name) || null;
    })
    .filter((c): c is CardRecord => Boolean(c));
  const benchmark = manaBaseBenchmark(matched, commanderCardsForBenchmark);

  renderWinCondition(winCons);
  renderArchetypeMatch(archetypeMatch);
  renderTableFeel(tableFeel, bracket.spirit);
  renderChart(
    { speed, consistency, versatility, disruption, powerLevel },
    commandSpark,
    agg,
    tierDiscrepancy,
  );
  renderManaCurveChart(agg);
  report.renderSynergyProfile(panels.synergy, agg, archetypeMatch, matched, commanders);
  renderBracket(bracket, agg);
  renderTypeTable(agg.typeFrequency, agg.totalCards, agg.avgCmc, agg.manaCurve);
  renderManaBase(agg, benchmark);
  report.renderKeyPieces(panels.keyPieces, agg);
  report.renderCommanderCentrality(ctx, agg, matched, commanders, winCons, archetypeMatch);
  const legalityReport = chartLegality(ctx, matched, commanders, notFound);
  renderLegality(legalityReport);
  report.renderCommanderTrackRecord(commanderTiers, tierDiscrepancy, ctx.winRates?.length ?? 0);

  resultsSection().style.display = "block";
  updateChart({ hasResult: true });

  setStatus(statusMessage(agg, matched.length, commanders));

  renderNotFound(notFound, fuzzyMatches);

  resultsSection().scrollIntoView({ behavior: "smooth", block: "start" });

  if (legalityReport.hardViolations.length) {
    showLegalityPopup(legalityReport.hardViolations);
  }
}
