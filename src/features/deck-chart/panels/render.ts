// Renders the four original Deck Chart panels (legality, mana curve, mana base, type table)
// into their existing page elements, and builds the legality report for the charted deck.

import { render } from "../../../ui/html.ts";
import { computeManaCurve } from "../../../engine/axes/shared.ts";
import { resolveCommanderName } from "../../../engine/commanders.ts";
import type { EngineContext } from "../../../engine/context.ts";
import type { DeckTallies } from "../../../engine/analyze-tallies.ts";
import type { CardRecord } from "../../../cards/tuple.ts";
import type { MatchedCard } from "../../../cards/lookup.ts";
import { checkLegality, manaBaseRows } from "../state.ts";
import type { LegalityReport } from "../state.ts";
import { legalityBadgeText, legalityTemplate } from "./legality.ts";
import { manaCurveTemplate } from "./mana-curve.ts";
import { manaBaseTemplate } from "./mana-base.ts";
import type { ManaBaseBenchmark } from "./mana-base.ts";
import { typeTableTemplate } from "./type-table.ts";

type ManaCurveInput = Parameters<typeof computeManaCurve>[0];
type ManaBaseInput = Pick<
  DeckTallies,
  "manaPipsRequired" | "manaSourcesAvailable" | "manaSourceCards" | "ritualCards"
>;

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function chartLegality(
  ctx: EngineContext,
  matched: MatchedCard[],
  commanders: string[],
  notFound: string[],
): LegalityReport {
  const commanderCards: CardRecord[] = (commanders || [])
    .map((name) => resolveCommanderName(ctx, name, matched))
    .filter((card): card is CardRecord => Boolean(card));
  return checkLegality({ matched, commanders, notFound, commanderCards });
}

export function renderLegality(report: LegalityReport): void {
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

export function renderManaCurveChart(agg: ManaCurveInput): void {
  const area = el("manaCurveArea");
  if (!area) return;
  const curve = computeManaCurve(agg);
  if (!curve || !curve.length) {
    render(null, area);
    return;
  }
  render(manaCurveTemplate(curve), area);
}

export function renderManaBase(agg: ManaBaseInput, benchmark?: ManaBaseBenchmark | null): void {
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

export function renderTypeTable(
  typeFrequency: Record<string, number>,
  totalCards: number,
  avgCmc: number,
  manaCurve?: Record<string, number> | null,
): void {
  const area = el("typeTableArea");
  if (!area) return;
  render(typeTableTemplate({ typeFrequency, totalCards, avgCmc, manaCurve }), area);
}
