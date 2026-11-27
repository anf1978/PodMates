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
  uid?: string | null;
  deckRef?: { uid: string; id: string };
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
  ignoreChronicleId?: string | null;
  isHost?: boolean;
  hostName?: string;
}

export interface ChronicleBattleDeck {
  commanderLabel?: string;
  commanders?: string[];
  name?: string;
  playerName?: string;
  uid?: string | null;
  commandSpark: number;
  style: string;
  color?: string;
  /** The saved deck played (owner + document id), so its Deck Log can count the battle. */
  deckRef?: { uid: string; id: string } | null;
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
      ...(deck.deckRef ? { deckRef: { uid: deck.deckRef.uid, id: deck.deckRef.id } } : {}),
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
  const ref = deck.deckRef as Record<string, unknown> | null | undefined;
  return {
    commander: typeof deck.commander === "string" ? deck.commander : undefined,
    name: typeof deck.name === "string" ? deck.name : undefined,
    player: typeof deck.player === "string" ? deck.player : undefined,
    spark:
      typeof deck.spark === "string" || typeof deck.spark === "number" ? deck.spark : undefined,
    ...(typeof deck.uid === "string" ? { uid: deck.uid } : {}),
    ...(ref && typeof ref.uid === "string" && typeof ref.id === "string"
      ? { deckRef: { uid: ref.uid, id: ref.id } }
      : {}),
  };
}

/** How long a logged battle stays on a player's "Battles to rate" list. */
export const SURVEY_WINDOW_MS = 30 * 86400000;

/**
 * The battles `uid` played in and has not rated or skipped yet, newest first: the after-battle
 * survey is answered later, from Chronicles, so nobody has to stop mid-game.
 */
export function pendingSurveys(
  entries: Chronicle[],
  uid: string | null,
  skipped: ReadonlySet<string>,
  now: number,
): Chronicle[] {
  if (!uid) return [];
  return entries
    .filter(
      (entry) =>
        Array.isArray(entry.participants) &&
        entry.participants.includes(uid) &&
        !(entry.feedbackResponses || []).some((response) => response?.uid === uid) &&
        !skipped.has(entry.id) &&
        now - (entry.createdAt || 0) <= SURVEY_WINDOW_MS,
    )
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** The player's own saved deck in a logged battle, for the survey's Spark question. */
export function surveyDeckFor(
  entry: Chronicle,
  uid: string | null,
): { ref: { uid: string; id: string }; name: string; spark: number } | null {
  if (!uid) return null;
  for (const value of entry.decks || []) {
    const deck = chronicleDeck(value);
    const spark = Number(deck.spark);
    if (deck.deckRef?.uid === uid && Number.isFinite(spark))
      return { ref: deck.deckRef, name: deck.commander || deck.name || "your deck", spark };
  }
  return null;
}

/** One line naming a battle: its commanders, for the survey list. */
export function battleLabel(entry: Chronicle): string {
  return (
    (entry.decks || [])
      .map(chronicleDeck)
      .map((deck) => deck.commander || deck.name)
      .filter(Boolean)
      .slice(0, 6)
      .join(" · ") || "Battle"
  );
}
