import { loadPodmateDecks } from "../../services/cloud/decks.ts";
import { loadAllChronicles } from "../../services/cloud/chronicles.ts";
import { loadPodMembers } from "../../services/cloud/members.ts";
import { getCurrentUser } from "../../services/cloud/session.ts";
import { publicProfileRuntime } from "./public-runtime.ts";
import type { ColorBreakdown, PublicProfileAnalysis, PublicProfileDeck } from "./public-types.ts";

export async function getPlayerRawDecksForProfile(uid: string): Promise<PublicProfileDeck[]> {
  const runtime = publicProfileRuntime();
  if (uid === getCurrentUser()?.uid) {
    return runtime.dropLinkedDuplicates(
      Object.values(runtime.loadSavedDecks()).filter(
        (deck) => typeof deck === "object" && deck.secret !== true,
      ),
    );
  }
  try {
    return runtime.dropLinkedDuplicates(Object.values(await loadPodmateDecks(uid)));
  } catch {
    return [];
  }
}

export function analyzeDecksForProfile(
  rawDecks: readonly PublicProfileDeck[],
): PublicProfileAnalysis[] {
  const out: PublicProfileAnalysis[] = [];
  for (const deck of rawDecks) {
    if (!deck?.list || !deck.commander) continue;
    const result = publicProfileRuntime().analyzeOneList(
      deck.list,
      deck.player || "",
      deck.commander,
    );
    if (result) {
      result._ownerUid = deck._ownerUid || null;
      result._ownerName = deck._ownerName || deck.player || "";
      result._rawList = deck.list;
      result._rawCommander = deck.commander;
      out.push(result);
    }
  }
  return out;
}

export async function getPodRawDecksForProfile(podId: string): Promise<PublicProfileDeck[]> {
  let members;
  try {
    members = await loadPodMembers(podId);
  } catch {
    return [];
  }
  const perMember = await Promise.all(
    members.map(async (member) => {
      const decks = await getPlayerRawDecksForProfile(member.uid);
      return decks.map((deck) => ({
        ...deck,
        _ownerUid: member.uid,
        _ownerName: member.displayLabel || member.displayName || "Podmate",
      }));
    }),
  );
  return perMember.flat();
}

interface PlayedDeck {
  commander?: string;
  uid?: string;
  player?: string;
}

function playedDeck(value: unknown): PlayedDeck | null {
  if (!value || typeof value !== "object") return null;
  const deck = value as Record<string, unknown>;
  return {
    commander: typeof deck.commander === "string" ? deck.commander : undefined,
    uid: typeof deck.uid === "string" ? deck.uid : undefined,
    player: typeof deck.player === "string" ? deck.player : undefined,
  };
}

/** Battles, rather than saved decks, determine the headline commander. */
export async function computeMostUsedCommander(
  podId: string | null | undefined,
  displayName: string,
  colors: readonly ColorBreakdown[],
  _dominantVibeTrait: string | null,
  uid: string,
): Promise<string | null> {
  if (!podId || !displayName) return null;
  let chronicles;
  try {
    chronicles = await loadAllChronicles(podId);
  } catch {
    return null;
  }
  let nameIsUnique = true;
  try {
    const members = await loadPodMembers(podId);
    nameIsUnique = !members.find((member) => member.uid === uid)?.nameClash;
  } catch {
    // Historical entries have only a player name; retain the legacy fallback.
  }
  const tally = new Map<string, number>();
  for (const entry of chronicles) {
    for (const value of entry.decks || []) {
      const deck = playedDeck(value);
      if (!deck?.commander) continue;
      const mine = deck.uid ? deck.uid === uid : nameIsUnique && deck.player === displayName;
      if (mine) tally.set(deck.commander, (tally.get(deck.commander) || 0) + 1);
    }
  }
  if (!tally.size) return null;
  const maxCount = Math.max(...tally.values());
  const tied = [...tally.keys()].filter((name) => tally.get(name) === maxCount);
  if (tied.length === 1) return tied[0];
  const colorPct = Object.fromEntries(colors.map((color) => [color.color, color.pct]));
  const indexes = publicProfileRuntime().getIndexes();
  const score = (name: string) => {
    const card = indexes?.byExactName.get(name.toLowerCase());
    return (card?.ci || "").split("").reduce((sum, color) => sum + (colorPct[color] || 0), 0);
  };
  tied.sort((a, b) => score(b) - score(a));
  return tied[0];
}
