// Pure table statistics, summary and mismatch signals; engine scores are never altered.
import type { ComparisonDeck } from "../../services/deck-analysis";
export type { ComparisonDeck };
export type Axis = keyof ComparisonDeck["scores"];
export const AXES: { key: Axis; label: string; mini: string }[] = [
  { key: "speed", label: "Speed", mini: "Speed" },
  { key: "consistency", label: "Consistency", mini: "Consist." },
  { key: "versatility", label: "Versatility", mini: "Versat." },
  { key: "disruption", label: "Disruption", mini: "Disrupt." },
  { key: "powerLevel", label: "Power Level", mini: "Power" },
];
export const tierOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
export const bestTier = (deck: ComparisonDeck) =>
  [...deck.commanderTiers].sort((a, b) => tierOrder[a.t] - tierOrder[b.t])[0];
export interface Note {
  text: string;
  names: string[];
}

export function tableState(input: readonly ComparisonDeck[]) {
  const decks = [...input].sort((a, b) => b.commandSpark - a.commandSpark);
  const sparks = decks.map((d) => d.commandSpark);
  const avgSpark = sparks.reduce((sum, v) => sum + v, 0) / sparks.length;
  const std = Math.sqrt(sparks.reduce((sum, v) => sum + (v - avgSpark) ** 2, 0) / sparks.length);
  const spread = Math.max(...sparks) - Math.min(...sparks);
  const label =
    spread <= 0.8 && std <= 0.4
      ? "Well Balanced"
      : spread <= 1.6 && std <= 0.7
        ? "Moderate Spread"
        : "High Variance";
  const detail =
    label === "Well Balanced"
      ? `The ${decks.length} decks sit close together (spread ${spread.toFixed(1)}). Expect relatively even games.`
      : label === "Moderate Spread"
        ? `Noticeable power differences (spread ${spread.toFixed(1)}). Games can still be fun, but the higher decks have an edge.`
        : `Large power gap (spread ${spread.toFixed(1)}). Consider swapping the strongest or weakest list for a fairer table.`;
  const outliers: Note[] = [];
  decks.forEach((d) => {
    const delta = d.commandSpark - avgSpark;
    if (delta >= 0.9)
      outliers.push({
        text: `${d.name} is notably stronger (+${delta.toFixed(1)} vs avg)`,
        names: [d.commanderLabel],
      });
    if (delta <= -0.9)
      outliers.push({
        text: `${d.name} is notably weaker (${delta.toFixed(1)} vs avg)`,
        names: [d.commanderLabel],
      });
  });
  return { decks, avgSpark, std, spread, label, detail, outliers };
}
export type TableState = ReturnType<typeof tableState>;

export function generatePodSummary(decks: readonly ComparisonDeck[]): string {
  const avg = (key: Axis): number =>
    decks.reduce((sum, d) => sum + d.scores[key], 0) / decks.length;
  const pace =
    avg("speed") >= 7 ? "high-speed" : avg("speed") >= 5 ? "moderate-paced" : "slow-building";
  const interaction =
    avg("disruption") >= 6
      ? "heavy disruption throughout"
      : avg("disruption") >= 3.5
        ? "a fair amount of interaction"
        : "relatively low interaction — mostly combat-focused";
  const counts: Record<string, number> = {};
  decks.forEach((d) => {
    counts[d.style] = (counts[d.style] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const style = top && top[1] >= Math.ceil(decks.length / 2) ? `, leaning ${top[0]}` : "";
  const callouts: string[] = [];
  for (const [key, label] of [
    ["disruption", "disruption"],
    ["speed", "speed"],
    ["powerLevel", "raw power"],
  ] as const) {
    const first = [...decks].sort((a, b) => b.scores[key] - a.scores[key])[0];
    if (first.scores[key] - avg(key) >= 1.5)
      callouts.push(`strong ${label} from ${first.playerName || first.name}`);
  }
  return `${pace.charAt(0).toUpperCase() + pace.slice(1)} table with ${interaction}${style}${callouts.length ? " — " + callouts.slice(0, 2).join(", ") : ""}.`;
}

export function buildPodMismatchNotes(decks: readonly ComparisonDeck[]): Note[] {
  if (decks.length < 2) return [];
  const notes: Note[] = [];
  const styles = [...new Set(decks.map((d) => d.style))];
  if (styles.length >= 3)
    notes.push({
      text: `Very mixed playstyles (${styles.join(", ")}) — expect uneven game texture even if Spark is close.`,
      names: [],
    });
  const free = decks.map((d) => d.agg.freeInteraction || 0);
  const maxFree = Math.max(...free);
  if (maxFree - Math.min(...free) >= 3) {
    const heavy = decks
      .filter((d) => (d.agg.freeInteraction || 0) === maxFree)
      .map((d) => d.commanderLabel || d.name);
    notes.push({
      text: `${heavy.join(" / ")} has much more free interaction — stack fights will favor them.`,
      names: heavy,
    });
  }
  const engines = decks.map((d) => d.agg.engineRatio || 0);
  if (Math.max(...engines) - Math.min(...engines) >= 0.15)
    notes.push({
      text: "Large gap in engine density: grindy decks may outlast glass-cannon plans.",
      names: [],
    });
  const versatility = decks.map((d) => d.scores.versatility);
  if (Math.max(...versatility) - Math.min(...versatility) >= 2)
    notes.push({
      text: "Versatility scores diverge sharply — decks with more win paths may adapt better if their first plan gets disrupted.",
      names: [],
    });
  const tiers = decks.map(bestTier).filter((t) => t !== undefined);
  if (
    tiers.length >= 2 &&
    Math.max(...tiers.map((t) => tierOrder[t.t])) - Math.min(...tiers.map((t) => tierOrder[t.t])) >=
      2
  ) {
    const strongest = tiers.reduce((a, b) => (tierOrder[a.t] < tierOrder[b.t] ? a : b));
    const weakest = tiers.reduce((a, b) => (tierOrder[a.t] > tierOrder[b.t] ? a : b));
    notes.push({
      text: `Commander track records diverge — ${strongest.n} is ${strongest.t}-tier (${strongest.w.toFixed(1)}% empirical win rate) while ${weakest.n} is ${weakest.t}-tier (${weakest.w.toFixed(1)}%). Even with similar Spark, real-world results have historically favored the stronger commander.`,
      names: [strongest.n, weakest.n],
    });
  }
  return notes;
}

export function analyzePaceInteractionRisks(decks: readonly ComparisonDeck[]): string[] {
  if (decks.length < 2) return [];
  const risks: string[] = [],
    name = (d: ComparisonDeck): string => d.commanderLabel || d.name;
  for (const d of decks) {
    const others = decks.filter((x) => x !== d);
    const avg = others.reduce((sum, x) => sum + x.pace, 0) / others.length;
    if (d.pace - avg >= 2.5) {
      const slowest = [...others]
        .sort((a, b) => a.pace - b.pace)
        .slice(0, 2)
        .map(name);
      risks.push(
        `${name(d)} sits well outside the pod's pace (${d.pace.toFixed(1)} vs pod average ${avg.toFixed(1)}) — it could end the game before ${slowest.join(" and ")} get to do much.`,
      );
    }
  }
  const heavy = decks.filter((d) => d.scores.disruption >= 7);
  if (heavy.length >= 2)
    risks.push(
      `${heavy.map(name).join(" and ")} are both heavy interaction — stacked together this could be a long, low-agency night for whoever's caught between them.`,
    );
  for (const d of decks) {
    if (d.scores.disruption > 3.5) continue;
    const others = heavy.filter((x) => x !== d).map(name);
    if (others.length)
      risks.push(
        `${name(d)} has very low interaction and shares a table with ${others.join(", ")}'s heavy disruption — ${name(d)} may have no way to respond if things go wrong.`,
      );
  }
  return risks;
}
