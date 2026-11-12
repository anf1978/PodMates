// Renders the Key Pieces, Synergy, Track Record and Centrality panels into their existing page
// elements. Each render starts from an empty area, as the old innerHTML writes did, so open
// <details> and filled picture rows never carry over from the previous deck.

import { computeManaCurve } from "../../engine/axes/shared.ts";
import { computeCommanderCentrality } from "../../engine/centrality.ts";
import type { EngineContext } from "../../engine/context.ts";
import type { CommanderTierRecord } from "../../engine/context.ts";
import type { SparkDiscrepancy } from "../../engine/commander-tiers.ts";
import type { DeckAnalysis } from "../../engine/analyze-tallies.ts";
import type { WinCondition } from "../../engine/types.ts";
import type { MatchedCard } from "../../cards/lookup.ts";
import { nothing, render } from "../../ui/html.ts";
import type { TemplateResult } from "../../ui/html.ts";
import { bindCentrality, centralityTemplate, type Centrality } from "./centrality/panel.ts";
import { fillKeyPieceThumbs, keyPiecesTemplate } from "./key-pieces/key-pieces.ts";
import type { KeyPiecesPorts } from "./key-pieces/key-pieces.ts";
import { synergyTemplate, type ArchetypeMatchLike, type SynergyPorts } from "./synergy/panel.ts";
import { trackRecordTemplate } from "./synergy/track-record.ts";

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function fresh(area: HTMLElement, template: TemplateResult): void {
  render(nothing, area);
  render(template, area);
}

function show(panel: HTMLElement, on: boolean): void {
  panel.style.display = on ? "block" : "none";
}

export type KeyPiecesInput = Parameters<typeof keyPiecesTemplate>[1] &
  Parameters<typeof computeManaCurve>[0];

export function renderKeyPieces(
  ports: Omit<KeyPiecesPorts, "manaCurve">,
  agg: KeyPiecesInput,
): void {
  const panel = el("keyPiecesPanel"),
    area = el("keyPiecesArea");
  if (!panel || !area) return;
  const full: KeyPiecesPorts = { ...ports, manaCurve: () => computeManaCurve(agg) };
  const template = keyPiecesTemplate(full, agg);
  if (!template) return show(panel, false);
  fresh(area, template);
  show(panel, true);
  void fillKeyPieceThumbs(full, agg, area);
}

export function renderSynergyProfile(
  ports: SynergyPorts,
  agg: Parameters<typeof synergyTemplate>[1],
  archetypeMatch: ArchetypeMatchLike | null | undefined,
  matched: MatchedCard[] | null | undefined,
  commanders: string[] | null | undefined,
): void {
  const panel = el("synergyPanel"),
    area = el("synergyArea");
  if (!panel || !area) return;
  fresh(area, synergyTemplate(ports, agg, archetypeMatch, matched, commanders));
  show(panel, true);
}

export function renderCommanderTrackRecord(
  tierRecords: readonly CommanderTierRecord[] | null | undefined,
  discrepancy: SparkDiscrepancy | null | undefined,
  trackedCommanders: number,
): void {
  const panel = el("commanderTrackPanel"),
    area = el("commanderTrackArea");
  if (!panel || !area) return;
  fresh(area, trackRecordTemplate(tierRecords, discrepancy, trackedCommanders));
  show(panel, true);
}

let currentCentrality: Centrality | null = null;

/** The last reading drawn, for the Centrality explainer. */
export function lastCentrality(): Centrality | null {
  return currentCentrality;
}

export function renderCommanderCentrality(
  ctx: EngineContext,
  agg: Pick<DeckAnalysis, "detectedComboDetails" | "synergyEdges">,
  matched: MatchedCard[],
  commanders: string[] | null | undefined,
  winCons: readonly WinCondition[] | null | undefined,
  archetypeMatch: ArchetypeMatchLike | null | undefined,
): void {
  const panel = el("centralityPanel"),
    area = el("centralityArea");
  if (!panel || !area) return;
  let r: Centrality | null = null;
  const arch = archetypeMatch?.top?.deck ? archetypeMatch.top.deck.archetype : null;
  try {
    r = computeCommanderCentrality(ctx, agg, matched, commanders, winCons, arch);
  } catch (e) {
    console.error(e);
  }
  currentCentrality = r;
  if (!r) return show(panel, false);
  fresh(area, centralityTemplate(r));
  bindCentrality(area);
  show(panel, true);
}
