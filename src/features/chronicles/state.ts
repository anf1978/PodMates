// Pure history grouping, participant permissions and optional feedback summaries.
import type {
  ChronicleDoc,
  ChronicleInput,
  FeedbackResponse,
  MemberRole,
  WithId,
} from "../../services/cloud/types";

export type Chronicle = WithId<ChronicleDoc>;

export interface ChronicleDeck {
  commander?: string;
  name?: string;
  player?: string;
  spark?: string | number;
}

export interface ChroniclesState {
  entries: Chronicle[];
  role: MemberRole;
  uid: string | null;
}

export interface ChronicleBattle {
  podId: string;
  gatheringId: string;
  gatheringTitle?: string;
  participants: Array<{ uid: string | null }>;
  loggedChronicleId?: string | null;
}

export interface ChronicleBattleDeck {
  commanderLabel?: string;
  commanders?: string[];
  name?: string;
  playerName?: string;
  uid?: string | null;
  commandSpark: number;
  style: string;
}

export function battleEntry(
  battle: ChronicleBattle,
  decks: ChronicleBattleDeck[],
  createdAt = Date.now(),
): ChronicleInput {
  return {
    createdAt,
    date: new Date(createdAt).toLocaleString(),
    notes: "",
    decks: decks.map((deck) => ({
      commander: deck.commanderLabel || (deck.commanders || []).join(" / ") || deck.name,
      player: deck.playerName || "",
      uid: deck.uid || null,
      spark: deck.commandSpark.toFixed(1),
      style: deck.style,
    })),
    gatheringId: battle.gatheringId,
    gatheringTitle: battle.gatheringTitle,
    participants: battle.participants.map((participant) => participant.uid),
  };
}

export function emptyState(uid: string | null = null): ChroniclesState {
  return { entries: [], role: "member", uid };
}

export function canEditChronicle(entry: Chronicle, state: ChroniclesState): boolean {
  if (!state.uid || !entry.id) return false;
  if (state.role === "leader" || state.role === "co-leader") return true;
  const players = Array.isArray(entry.participants) ? entry.participants : [];
  return players.length === 0 || players.includes(state.uid);
}

export function groupChronicles(entries: Chronicle[]): Map<string, Chronicle[]> {
  const groups = new Map<string, Chronicle[]>();
  for (const entry of entries) {
    const title = entry.gatheringTitle || "Earlier Chronicles";
    const group = groups.get(title) || [];
    group.push(entry);
    groups.set(title, group);
  }
  return groups;
}

export function feedbackSummary(responses: FeedbackResponse[]): {
  fun: string | null;
  accuracy: string | null;
  moments: string[];
} {
  const average = (values: unknown[]): string | null => {
    const numbers = values.filter((value): value is number => typeof value === "number");
    return numbers.length
      ? (numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(1)
      : null;
  };
  return {
    fun: average(responses.map((response) => response.fun)),
    accuracy: average(responses.map((response) => response.accuracy)),
    moments: responses.map((response) => response.bestMoment).filter(Boolean),
  };
}

export function chronicleDeck(value: unknown): ChronicleDeck {
  if (!value || typeof value !== "object") return {};
  const deck = value as Record<string, unknown>;
  return {
    commander: typeof deck.commander === "string" ? deck.commander : undefined,
    name: typeof deck.name === "string" ? deck.name : undefined,
    player: typeof deck.player === "string" ? deck.player : undefined,
    spark:
      typeof deck.spark === "string" || typeof deck.spark === "number" ? deck.spark : undefined,
  };
}
