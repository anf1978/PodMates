import type { DeckAnalysis } from "../../engine/analyze-tallies.ts";

export interface PublicProfileDeck {
  list?: string;
  commander?: string;
  player?: string;
  secret?: boolean;
  docId?: string;
  ownerUid?: string;
  _ownerUid?: string | null;
  _ownerName?: string;
}

/** The part of the shared legacy analysis result consumed by public profiles. */
export interface PublicProfileAnalysis {
  agg: DeckAnalysis;
  name: string;
  commanderLabel: string;
  commanders: string[];
  style: string;
  pace: number;
  scores: { disruption: number };
  bracket?: { bracketKey: string } | null;
  _ownerUid?: string | null;
  _ownerName?: string;
  _rawList?: string;
  _rawCommander?: string;
}

export interface PublicProfilePod {
  id: string;
  name: string;
}

export interface ColorBreakdown {
  color: string;
  pct: number;
}

export interface TypeBreakdown {
  type: string;
  pct: number;
}

export interface BracketDistribution {
  key: string;
  label: string;
  count: number;
}

export interface ProfileOwner {
  key: string;
  name: string;
}
