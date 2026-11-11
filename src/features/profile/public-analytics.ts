import { detectWinCondition } from "../../engine/win-condition.ts";
import { TABLE_VIBE_ARCHETYPES } from "../../engine/table-feel.ts";
import type { DeckAnalysis } from "../../engine/analyze-tallies.ts";
import type {
  BracketDistribution,
  ColorBreakdown,
  ProfileOwner,
  PublicProfileAnalysis,
  TypeBreakdown,
} from "./public-types.ts";

const PROFILE_TYPE_PRIORITY = [
  "Planeswalker",
  "Battle",
  "Creature",
  "Kindred",
  "Artifact",
  "Enchantment",
  "Instant",
  "Sorcery",
  "Land",
  "Unknown",
];

/** A multi-type card contributes once to a pie, unlike the frequency table. */
export function primaryTypeTotalsForDeck(agg: Pick<DeckAnalysis, "cardsByType">) {
  const claimed = new Set<string>();
  const totals: Record<string, number> = {};
  for (const type of PROFILE_TYPE_PRIORITY) {
    for (const entry of agg.cardsByType[type] || []) {
      if (claimed.has(entry.name)) continue;
      claimed.add(entry.name);
      totals[type] = (totals[type] || 0) + entry.qty;
    }
  }
  return totals;
}

export function computeProfileColorBreakdown(
  decks: readonly Pick<PublicProfileAnalysis, "agg">[],
): ColorBreakdown[] {
  const totals: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const { agg } of decks) {
    for (const color of ["W", "U", "B", "R", "G"]) {
      totals[color] += agg.manaPipsRequired?.[color] || 0;
    }
    // Colorless cards, not the rare literal {C} symbol, are the colorless commitment.
    totals.C += agg.colorlessNonlandCount || 0;
  }
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  return Object.entries(totals)
    .filter(([, value]) => value > 0)
    .map(([color, value]) => ({ color, pct: (value / total) * 100 }))
    .sort((a, b) => b.pct - a.pct);
}

export function computeProfileTypeBreakdown(
  decks: readonly Pick<PublicProfileAnalysis, "agg">[],
): TypeBreakdown[] {
  const totals: Record<string, number> = {};
  for (const { agg } of decks) {
    for (const [type, value] of Object.entries(primaryTypeTotalsForDeck(agg))) {
      totals[type] = (totals[type] || 0) + value;
    }
  }
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  return Object.entries(totals)
    .map(([type, value]) => ({ type, pct: (value / total) * 100 }))
    .sort((a, b) => b.pct - a.pct);
}

export function getDeckArchetypeLabel(deck: PublicProfileAnalysis): string {
  const winCons = detectWinCondition(deck.agg);
  if (
    winCons.length &&
    winCons[0].confidence !== "fallback" &&
    TABLE_VIBE_ARCHETYPES[winCons[0].label]
  ) {
    return winCons[0].label;
  }
  return deck.style || "Unclassified";
}

export function computeProfileArchetypeTable(decks: readonly PublicProfileAnalysis[]) {
  return decks
    .map((deck) => ({
      archetype: getDeckArchetypeLabel(deck),
      commander: deck.commanderLabel || deck.commanders.join(" / ") || deck.name,
    }))
    .sort(
      (a, b) => a.archetype.localeCompare(b.archetype) || a.commander.localeCompare(b.commander),
    );
}

export function computeProfileVibeTrait(decks: readonly PublicProfileAnalysis[]): string | null {
  const tally: Record<string, number> = { Timmy: 0, Johnny: 0, Spike: 0 };
  for (const deck of decks) {
    const vibe = TABLE_VIBE_ARCHETYPES[getDeckArchetypeLabel(deck)];
    if (!vibe) continue;
    const traits = vibe.label
      .replace(/\([^)]*\)/g, "")
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const trait of traits) {
      if (tally[trait] !== undefined) tally[trait] += 1;
    }
  }
  const entries = Object.entries(tally).filter(([, value]) => value > 0);
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

export function computeProfileBracketDistribution(
  decks: readonly Pick<PublicProfileAnalysis, "bracket">[],
): BracketDistribution[] {
  const order = ["1-2", "3", "4"];
  const labels: Record<string, string> = {
    "1-2": "1–2 (Exhibition / Core)",
    "3": "3 (Upgraded)",
    "4": "4 (Optimized)",
  };
  const counts: Record<string, number> = { "1-2": 0, "3": 0, "4": 0 };
  for (const deck of decks) {
    const key = deck.bracket?.bracketKey;
    if (key && counts[key] !== undefined) counts[key] += 1;
  }
  return order
    .map((key) => ({ key, label: labels[key], count: counts[key] }))
    .filter((b) => b.count > 0);
}

export function assignPlayerColors(
  decks: readonly Pick<PublicProfileAnalysis, "_ownerUid" | "_ownerName">[],
  palette: readonly string[],
): { colorMap: Record<string, string>; owners: ProfileOwner[] } {
  const owners: ProfileOwner[] = [];
  const seen = new Set<string>();
  for (const deck of decks) {
    const key = deck._ownerUid || deck._ownerName || "unknown";
    if (!seen.has(key)) {
      seen.add(key);
      owners.push({ key, name: deck._ownerName || "Unknown" });
    }
  }
  const colorMap: Record<string, string> = {};
  owners.forEach((owner, i) => {
    colorMap[owner.key] = palette[i % palette.length];
  });
  return { colorMap, owners };
}
