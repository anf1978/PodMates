// Pod proposals are differences from the default list, used only for the separate Pod view.
import { DEFAULT_IMPACT_CARDS } from "../../data/impact-defaults";
import { scorePowerLevel, type DeckAnalysis } from "../../engine";
import { impactCardsInDeck } from "../../engine/axes/power-level";
import { computeSpark } from "../../engine/spark";
import type {
  ImpactChange,
  ImpactDismissal,
  ImpactNominationDoc,
  PodDoc,
  WithId,
} from "../../services/cloud/types";

export type Candidate = readonly [string, string, number, number, number, number, string];
export type Change = ImpactChange & { card: string; action: "add" | "remove" };
export interface ChartAnalysis {
  agg: DeckAnalysis;
  scores: {
    speed: number;
    consistency: number;
    versatility: number;
    disruption: number;
    powerLevel: number;
  };
  spark: number;
}
export interface ImpactState {
  pods: WithId<PodDoc>[] | null;
  podId: string | null;
  changes: Record<string, ImpactChange>;
  updatedAt: number | null;
  loadedFor: string | null;
  openReasonKey: string | null;
  busy: boolean;
  dismissed: Record<string, ImpactDismissal>;
  nominations: WithId<ImpactNominationDoc>[];
  nomOk: boolean;
  candMore: boolean;
  confirmReset: boolean;
}

export function createState(): ImpactState {
  return {
    pods: null,
    podId: null,
    changes: {},
    updatedAt: null,
    loadedFor: null,
    openReasonKey: null,
    busy: false,
    dismissed: {},
    nominations: [],
    nomOk: true,
    candMore: false,
    confirmReset: false,
  };
}
export function impactKey(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}
export function isDefault(name: string): boolean {
  return DEFAULT_IMPACT_CARDS.some((n) => n.toLowerCase() === name.toLowerCase());
}
export function cleanChanges(raw: Record<string, ImpactChange>): Record<string, Change> {
  const out: Record<string, Change> = {};
  for (const [key, c] of Object.entries(raw || {})) {
    if (!c || typeof c.card !== "string" || !c.card || c.card.length > 200) continue;
    if ((c.action === "remove" && isDefault(c.card)) || (c.action === "add" && !isDefault(c.card)))
      out[key] = { ...c, card: c.card, action: c.action };
  }
  return out;
}
export function effectiveList(changes: Record<string, ImpactChange>): string[] {
  const entries = Object.values(cleanChanges(changes));
  const removed = new Set(
    entries.filter((c) => c.action === "remove").map((c) => c.card.toLowerCase()),
  );
  const out = DEFAULT_IMPACT_CARDS.filter((n) => !removed.has(n.toLowerCase()));
  for (const c of entries) {
    if (c.action === "add" && !out.some((n) => n.toLowerCase() === c.card.toLowerCase()))
      out.push(c.card);
  }
  return out;
}
export function candidates(rows: readonly Candidate[], state: ImpactState): Candidate[] {
  const effective = new Set(effectiveList(state.changes).map((n) => n.toLowerCase()));
  const nominated = new Set(state.nominations.map((n) => impactKey(n.card)));
  const groups = new Map<string, Candidate[]>();
  for (const c of rows) {
    if (
      effective.has(c[0].toLowerCase()) ||
      state.dismissed[impactKey(c[0])] ||
      nominated.has(impactKey(c[0])) ||
      isDefault(c[0])
    )
      continue;
    const group = groups.get(c[1]) || [];
    group.push(c);
    groups.set(c[1], group);
  }
  const queues = [...groups.values()],
    out: Candidate[] = [];
  for (let i = 0; queues.some((q) => q[i]); i++) {
    for (const queue of queues) if (queue[i]) out.push(queue[i]);
  }
  return out;
}
export function currentPod(state: ImpactState): WithId<PodDoc> | null {
  return state.pods?.find((p) => p.id === state.podId) || null;
}
export function canEdit(state: ImpactState, uid: string | null): boolean {
  const pod = currentPod(state);
  return !!uid && !!pod && (pod.leaderId === uid || (pod.coLeaderIds || []).includes(uid));
}
export function computePodView(chart: ChartAnalysis | null, changes: Record<string, ImpactChange>) {
  if (!chart) return null;
  const list = effectiveList(changes);
  const power = scorePowerLevel(chart.agg, list);
  const s = chart.scores;
  return {
    power,
    spark: computeSpark(s.speed, s.consistency, s.versatility, s.disruption, power),
    hits: impactCardsInDeck(chart.agg, list),
  };
}
