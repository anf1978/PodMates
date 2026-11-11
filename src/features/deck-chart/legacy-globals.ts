// Strangler shim: publishes the Deck Chart panel renderers on `window` under the names the
// inline app script in index.html still calls. No behaviour lives here -- it only gathers the
// page's data, calls the feature, and writes the result into the existing panel elements.

import { render } from "../../ui/html.ts";
import { computeManaCurve } from "../../engine/axes/shared.ts";
import { resolveCommanderName } from "../../engine/commanders.ts";
import { pageContext } from "../../engine/legacy-globals.ts";
import type { DeckTallies } from "../../engine/analyze-tallies.ts";
import type { CardRecord } from "../../cards/tuple.ts";
import type { MatchedCard } from "../../cards/lookup.ts";
import { checkLegality, manaBaseRows } from "./state.ts";
import type { LegalityReport } from "./state.ts";
import { legalityBadgeText, legalityTemplate } from "./panels/legality.ts";
import { manaCurveTemplate } from "./panels/mana-curve.ts";
import { manaBaseTemplate } from "./panels/mana-base.ts";
import type { ManaBaseBenchmark } from "./panels/mana-base.ts";
import { typeTableTemplate } from "./panels/type-table.ts";
import { buildInteractionPackages, showSuggestions } from "./interactions/index.ts";
import type {
  InteractionData,
  InteractionTags,
  KnowCard,
  KnowledgeJson,
  SuggestionPorts,
} from "./interactions/index.ts";
import { comboCardByName } from "../../engine/combos.ts";
import { fetchCardImagesBatch } from "../../services/card-art.ts";
import { gameChangerChipsHtml, linkifyKnownCardNames } from "./explainers/card-text.ts";
import { explainerButtonHtml } from "./explainers/button.ts";
import { bindExplainerClicks, type ExplainerPorts } from "./explainers/index.ts";
import type { ContribAgg } from "./explainers/contributors.ts";
import type { StaplesResult } from "./synergy/sections.ts";
import type { SynergyAgg } from "./synergy/panel.ts";
import * as report from "./report.ts";

type ManaCurveInput = Parameters<typeof computeManaCurve>[0];
type ManaBaseInput = Pick<
  DeckTallies,
  "manaPipsRequired" | "manaSourcesAvailable" | "manaSourceCards" | "ritualCards"
>;

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function legacyCheckLegality(
  matched: MatchedCard[],
  commanders: string[],
  notFound: string[],
): LegalityReport {
  const commanderCards: CardRecord[] = (commanders || [])
    .map((name) => resolveCommanderName(pageContext(), name, matched))
    .filter((card): card is CardRecord => Boolean(card));
  return checkLegality({ matched, commanders, notFound, commanderCards });
}

function renderLegality(report: LegalityReport): void {
  const panel = el("legalityPanel");
  const area = el("legalityArea");
  const badge = el("legalityBadge");
  if (!panel || !area) return;
  if (badge) {
    badge.textContent = legalityBadgeText(report);
    badge.classList.toggle("dc-badge-ok", report.ok);
    badge.classList.toggle("dc-badge-notes", !report.ok);
  }
  render(legalityTemplate(report), area);
  panel.style.display = "block";
}

function renderManaCurveChart(agg: ManaCurveInput): void {
  const area = el("manaCurveArea");
  if (!area) return;
  const curve = computeManaCurve(agg);
  if (!curve || !curve.length) {
    render(null, area);
    return;
  }
  render(manaCurveTemplate(curve), area);
}

function renderManaBase(agg: ManaBaseInput, benchmark?: ManaBaseBenchmark | null): void {
  const panel = el("manaBasePanel");
  const area = el("manaBaseArea");
  if (!panel || !area) return;

  const pips = agg.manaPipsRequired || {};
  const sources = agg.manaSourcesAvailable || {};
  const rows = manaBaseRows(pips, sources);
  if (rows.length === 0) {
    panel.style.display = "none";
    return;
  }

  // Colourless production is only worth a note when the deck has no {C} costs; otherwise it
  // is already one of the rows above.
  const colorlessSources = (sources.C || 0) > 0 && !(pips.C > 0) ? sources.C : 0;

  render(
    manaBaseTemplate({
      rows,
      colorlessSources,
      colorlessNames: [...new Set((agg.manaSourceCards && agg.manaSourceCards.C) || [])],
      ritualNames: [...new Set(agg.ritualCards || [])],
      benchmark,
    }),
    area,
  );
  panel.style.display = "block";
}

function renderTypeTable(
  typeFrequency: Record<string, number>,
  totalCards: number,
  avgCmc: number,
  manaCurve?: Record<string, number> | null,
): void {
  const area = el("typeTableArea");
  if (!area) return;
  render(typeTableTemplate({ typeFrequency, totalCards, avgCmc, manaCurve }), area);
}

// Page data owned by the inline boot adapter and lazy loaders (index.html).
declare const CARD_DB: CardRecord[];
declare const IX_TAGS: InteractionTags;
declare const KNOW_JSON: KnowledgeJson;
declare const KNOW_MAP: Map<string, KnowCard>;
declare function loadKnowledge(): Promise<void>;
// Current chart state and reference-set helpers (inline runAnalysis / renderChart).
declare const currentAgg: ContribAgg | null;
declare const currentWinCons: { label: string }[] | null;
declare const currentScores: Record<string, number> | null;
declare const currentCommandSpark: number | null;
declare const AXES: { key: string; label: string }[];
declare function computeSparkPercentile(value: number): number;
declare function computeAxisPercentile(key: string, value: number): number | null;
declare function describeTierPlacement(value: number, key?: string): string;
declare function referenceSetSummary(): string;
declare function computeStaplesDeviation(agg: SynergyAgg, archetype: string): StaplesResult;

function interactionData(): InteractionData {
  return { cards: CARD_DB, tags: IX_TAGS };
}

const suggestionPorts: SuggestionPorts = {
  data: interactionData,
  loadKnowledge: () => loadKnowledge(),
  knowledge: () => ({ json: KNOW_JSON, byName: KNOW_MAP }),
  // Written by the inline renderBracket for this note only.
  bracket: () => {
    const page = window as unknown as { __pmBracketKey?: string; __pmGcHeld?: number };
    return { key: page.__pmBracketKey, held: page.__pmGcHeld || 0 };
  },
};

const explainerPorts: ExplainerPorts = {
  agg: () => currentAgg,
  winCons: () => currentWinCons,
  scores: () => currentScores,
  commandSpark: () => currentCommandSpark,
  centrality: report.lastCentrality,
  axes: () => AXES,
  sparkPercentile: (value) => computeSparkPercentile(value),
  axisPercentile: (key, value) => computeAxisPercentile(key, value),
  tierPlacement: (value, key) =>
    key === undefined ? describeTierPlacement(value) : describeTierPlacement(value, key),
  referenceSummary: () => referenceSetSummary(),
};

function goToKeyPieces(): void {
  const panel = document.getElementById("keyPiecesPanel");
  if (!panel) return;
  const d = panel.querySelector("details");
  if (d) d.open = true;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

bindExplainerClicks(explainerPorts, goToKeyPieces);

const keyPiecesPorts = {
  comboCard: (name: string) => comboCardByName(pageContext(), name) ?? null,
  // The decoded snapshot carries its build date beside the typed fields.
  spellbookDate: () => (pageContext().spellbook?.snap as { date?: string } | undefined)?.date,
  fetchImages: (names: string[]) => fetchCardImagesBatch(names),
};

const synergyPorts = {
  packages: (matched: MatchedCard[], commanders: string[]) =>
    buildInteractionPackages(interactionData(), matched, commanders),
  staples: (agg: SynergyAgg, archetype: string) => computeStaplesDeviation(agg, archetype),
};

// The Synergy panel's "Cards you could add ›" button.
document.addEventListener("click", (event) => {
  const target = event.target as Element | null;
  if (target?.closest?.("[data-show-ix-suggestions]")) void showSuggestions(suggestionPorts);
});

type SynergyArgs = Parameters<typeof report.renderSynergyProfile>;
type CentralityArgs = Parameters<typeof report.renderCommanderCentrality>;

const legacy = {
  renderKeyPieces: (agg: report.KeyPiecesInput) => report.renderKeyPieces(keyPiecesPorts, agg),
  renderSynergyProfile: (
    agg: SynergyArgs[1],
    archetypeMatch: SynergyArgs[2],
    matched: SynergyArgs[3],
    commanders: SynergyArgs[4],
  ) => report.renderSynergyProfile(synergyPorts, agg, archetypeMatch, matched, commanders),
  renderCommanderCentrality: (
    agg: CentralityArgs[1],
    matched: CentralityArgs[2],
    commanders: CentralityArgs[3],
    winCons: CentralityArgs[4],
    archetypeMatch: CentralityArgs[5],
  ) =>
    report.renderCommanderCentrality(
      pageContext(),
      agg,
      matched,
      commanders,
      winCons,
      archetypeMatch,
    ),
  renderCommanderTrackRecord: (
    records: Parameters<typeof report.renderCommanderTrackRecord>[0],
    discrepancy: Parameters<typeof report.renderCommanderTrackRecord>[1],
  ) => report.renderCommanderTrackRecord(records, discrepancy, pageContext().winRates?.length ?? 0),
  explainerBtn: explainerButtonHtml,
  gameChangerChips: gameChangerChipsHtml,
  linkifyKnownCardNames,
  checkLegality: legacyCheckLegality,
  renderLegality,
  renderManaCurveChart,
  renderManaBase,
  renderTypeTable,
};

type LegacyDeckChart = typeof legacy;

declare global {
  // TODO(p3-6): drop these once runAnalysis and the result panels live in src/features/deck-chart.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends LegacyDeckChart {}
}

Object.assign(window, legacy);
