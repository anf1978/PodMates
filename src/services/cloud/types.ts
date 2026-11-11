// Firestore document shapes, derived from what the app reads and writes. Paths and field names are
// a contract with real user data: never rename or move them. Timestamps written with
// serverTimestamp() are typed as `unknown` because the app never reads them back.

/** users/{uid} */
export interface UserDoc {
  podIds?: string[];
  archidektProfileUrl?: string;
  moxfieldProfileUrl?: string;
}

/** users/{uid}/decks/{safeDocId(key) | linked-{platform}-{deckId}} */
export interface DeckDoc {
  key: string;
  commander: string;
  player: string;
  list: string;
  deckName: string;
  savedAt: number;
  /** Missing on decks saved before the toggle existed; loadAllDecks backfills `false`. */
  secret?: boolean;
  updatedAt?: unknown;
}

export interface DeckInput {
  commander?: string;
  player?: string;
  list?: string;
  deckName?: string;
  savedAt?: number;
  secret?: boolean;
}

export interface SavedDeck {
  list: string;
  commander: string;
  player: string;
  deckName: string;
  savedAt: number;
  secret: boolean;
  docId: string;
}

export type PodmateDeck = Omit<SavedDeck, "deckName" | "secret"> & { secret: false };

/** users/{uid}/linkedDecks/{platform}-{deckId} */
export interface LinkedDeckDoc {
  platform: string;
  deckId: string;
  url: string;
  name: string;
  commander: string;
  decklistText: string;
  cardCount: number;
  addedAt?: number;
  syncedAt: number;
}

/** Deck returned by the deck-link sync Worker. */
export interface FetchedDeck {
  platform: string;
  deckId: string;
  url: string;
  name?: string;
  commander?: string;
  decklistText?: string;
  cardCount: number;
}

/** users/{uid}/spoilerVotes/{safeDocId(key)} */
export interface SpoilerVoteDoc {
  key: string;
  n: string;
  setName: string;
  vote: "like" | "pass";
  votedAt: number;
  updatedAt?: unknown;
}

export interface TradeSale {
  qty: number;
  yen: number;
  feePct: number;
  shipYen: number;
  packYen: number;
  date: string;
}

/** users/{uid}/trades/{id} */
export interface TradeDoc {
  card: string;
  key: string;
  finish: "" | "nonfoil" | "foil" | "etched";
  paper: boolean;
  qty: number;
  buyYen: number;
  buyExtraYen: number;
  buyDate: string;
  shop: string;
  tag: "" | "riser" | "spoiler" | "other";
  note: string;
  sells: TradeSale[];
  markYen: number | null;
  markDate: string;
  createdAt: number;
  updatedAt: number;
}

/** Unvalidated trade from the ledger form; cleanTrade decides what is stored. */
export interface TradeInput {
  id?: string;
  createdAt?: number;
  card?: unknown;
  key?: unknown;
  finish?: unknown;
  paper?: unknown;
  qty?: unknown;
  buyYen?: unknown;
  buyExtraYen?: unknown;
  buyDate?: unknown;
  shop?: unknown;
  tag?: unknown;
  note?: unknown;
  sells?: Array<Record<string, unknown>>;
  markYen?: unknown;
  markDate?: unknown;
}

/** pods/{podId} */
export interface PodDoc {
  name: string;
  leaderId: string;
  coLeaderIds: string[];
  memberIds: string[];
  inviteCode: string;
  createdAt?: unknown;
}

export type MemberRole = "leader" | "co-leader" | "member";

/** pods/{podId}/members/{uid} */
export interface MemberDoc {
  displayName: string;
  role: MemberRole;
  joinedAt: number;
}

export interface PodMember extends MemberDoc {
  uid: string;
  nameClash: boolean;
  displayLabel: string;
}

/** pods/{podId}/activity/{autoId} */
export interface ActivityDoc {
  type: string;
  by: string;
  byName: string;
  subject: string;
  createdAt: number;
  ref?: string;
  to?: string[];
}

export interface ActivityOptions {
  podIds?: string[];
  ref?: string;
  to?: string[];
}

/** A deck snapshot stored in seats, formations and chronicles; shape is owned by the page. */
export interface SharedDeck {
  list?: string;
  [field: string]: unknown;
}

/** pods/{podId}/tableFormations/{safeDocId(name)} */
export interface TableFormationDoc {
  name: string;
  seats: unknown[];
  savedAt: number;
  savedBy: string;
  updatedAt?: unknown;
}

export interface FeedbackResponse {
  uid: string;
  displayName: string;
  fun: unknown;
  accuracy: unknown;
  bestMoment: string;
  submittedAt: number;
}

/** pods/{podId}/chronicles/{autoId} */
export interface ChronicleDoc {
  date: string;
  notes: string;
  decks: unknown[];
  createdAt: number;
  loggedBy: string;
  gatheringId: string | null;
  gatheringTitle: string | null;
  participants: unknown[];
  feedbackResponses: FeedbackResponse[];
  notesEditedAt?: number;
  notesEditedBy?: string;
}

export interface ChronicleInput {
  date?: string;
  notes?: string;
  decks?: unknown[];
  createdAt?: number;
  gatheringId?: string;
  gatheringTitle?: string;
  participants?: unknown[];
}

export type GatheringStatus = "setup" | "proposed" | "live" | "ended" | "cancelled";
export type SeatRsvp = "accepted" | "declined" | "invited";

export interface GatheringSeat {
  uid: string | null;
  displayName: string | null;
  deck: SharedDeck | null;
  rsvp?: SeatRsvp;
  guest?: boolean;
}

/** pods/{podId}/gatherings/{autoId}; seats is a map keyed "0".."5", written by field path. */
export interface GatheringDoc {
  title: string;
  hostUid: string;
  status: GatheringStatus;
  seats: Record<string, GatheringSeat>;
  createdAt: number;
  updatedAt?: unknown;
  goLiveAt?: number;
  whenDate?: string;
  whenTime?: string;
  place?: string;
  chartedAt?: number;
  lastLoggedChronicleId?: string | null;
  lastLoggedAt?: number | null;
  endedAt?: number;
  cancelledAt?: number;
}

export interface ImpactChange {
  card?: string;
  action?: "add" | "remove";
  reason?: string;
  by?: string;
  byName?: string;
  at?: number;
  reasonBy?: string;
  reasonAt?: number;
}

export interface ImpactDismissal {
  card: string;
  by: string;
  byName: string;
  at: number;
}

/** pods/{podId}/settings/impactCards */
export interface ImpactSettingsDoc {
  changes: Record<string, ImpactChange>;
  dismissed?: Record<string, ImpactDismissal>;
  updatedAt?: unknown;
  resetBy?: string;
}

/** pods/{podId}/impactNominations/{key} */
export interface ImpactNominationDoc {
  card: string;
  note: string;
  by: string;
  byName: string;
  at: number;
}

export type WithId<T> = T & { id: string };
