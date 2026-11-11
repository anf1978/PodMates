// Saved decks scored for the comparison tables (Build Table and My Profile).
import type { analyzeList } from "./deck-analysis";
import { tierPlacements } from "./reference-data";

export type AnalyzeDeck = (
  raw: string,
  player: string,
  commander: string,
) => ReturnType<typeof analyzeList>;

export interface DeckRow {
  key: string;
  commander: string;
  player: string;
  speed: number;
  consistency: number;
  versatility: number;
  disruption: number;
  powerLevel: number;
  commandSpark: number;
  pctPrecon: number;
  pctTuned: number;
  pctCedh: number;
  bracket: string;
}

type RowSource = string | { list?: string; player?: string; commander?: string };

/** One row per deck that parses; `failed` counts the ones that did not. */
export function analyzeDeckRows(
  decks: Record<string, RowSource>,
  analyze: AnalyzeDeck,
): { rows: DeckRow[]; failed: number } {
  const rows: DeckRow[] = [];
  let failed = 0;
  for (const [key, entry] of Object.entries(decks)) {
    const raw = typeof entry === "string" ? entry : entry.list || "";
    const player = typeof entry === "object" ? entry.player || "" : "";
    const commander = typeof entry === "object" ? entry.commander || "" : "";
    const result = analyze(raw, player, commander);
    if (!result) {
      failed++;
      continue;
    }
    // Spark percentile within each reference tier (share of that tier's decks scored above).
    const [precon, tuned, cedh] = tierPlacements(result.commandSpark);
    rows.push({
      key,
      commander: result.commanderLabel,
      player: result.playerName,
      speed: result.scores.speed,
      consistency: result.scores.consistency,
      versatility: result.scores.versatility,
      disruption: result.scores.disruption,
      powerLevel: result.scores.powerLevel,
      commandSpark: result.commandSpark,
      pctPrecon: precon!.pctBelow,
      pctTuned: tuned!.pctBelow,
      pctCedh: cedh!.pctBelow,
      bracket: result.bracket.bracket,
    });
  }
  return { rows, failed };
}
