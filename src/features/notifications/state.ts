// Device-local inbox state and pure activity filtering; never sends email or push alerts.
import type { ActivityItem } from "../../services/cloud/activity";
import type { PodDoc, WithId } from "../../services/cloud/types";

export const TYPES = {
  deck: {
    label: "A podmate charts a new deck",
    tag: "Deck",
    text: (n: string, s?: string) => n + " charted a new deck" + (s ? ": " + s : ""),
  },
  // Stored as a "deck" activity with ref "updated" (the live rules accept only the existing
  // types); kindOf() turns it into this kind so it has its own label and switch.
  deckUpdated: {
    label: "A podmate updates a deck",
    tag: "Deck",
    text: (n: string, s?: string) => n + " updated a deck" + (s ? ": " + s : ""),
  },
  gathering: {
    label: "A gathering is set up",
    tag: "Gathering",
    text: (n: string, s?: string) => n + " invited the pod to a gathering" + (s ? ": " + s : ""),
  },
  live: {
    label: "A gathering goes live",
    tag: "Live",
    text: (n: string, s?: string) =>
      n + " started the gathering" + (s ? ' "' + s + '"' : "") + " — it is live now",
  },
  nomination: {
    label: "Someone nominates an Impact card",
    tag: "Nomination",
    text: (n: string, s?: string) => n + " nominated " + (s || "a card") + " as an Impact card",
  },
  invite: {
    label: "You are invited to a gathering",
    tag: "Invite",
    text: (n: string, s?: string) =>
      n + ' invited you to "' + (s || "a gathering") + '" — reply in My Pods',
  },
  rsvp: {
    label: "Someone replies to your invite",
    tag: "Reply",
    text: (n: string, s?: string) => n + " " + (s || "replied"),
  },
  cancelled: {
    label: "A gathering is cancelled",
    tag: "Cancelled",
    text: (n: string, s?: string) => n + ' cancelled "' + (s || "the gathering") + '"',
  },
  // Not a Firestore activity: built on the device from Try-a-Deck decks with an `addedAt` date.
  tryADeck: {
    label: "A deck is added to Try a Deck",
    tag: "New deck",
    text: (_n: string, s?: string) => "New in Try a Deck: " + (s || "a deck"),
  },
  joined: {
    label: "Someone joins a pod",
    tag: "Joined",
    text: (n: string, s?: string) => n + " joined " + (s || "the pod"),
  },
};

export type NotificationType = keyof typeof TYPES;
export type NotificationItem = ActivityItem & { type: NotificationType };
export type Pod = WithId<PodDoc>;
export interface Preferences {
  types: Record<string, boolean>;
  muted: Record<string, boolean>;
}
export interface InboxState {
  uid: string | null;
  pods: Pod[];
  feeds: Map<string, ActivityItem[]>;
  /** Recently added Try-a-Deck decks, as inbox items (podId "", ref = the deck's key). */
  library: NotificationItem[];
  seenAt: number;
  prefs: Preferences;
}

export function initialState(): InboxState {
  return {
    uid: null,
    pods: [],
    feeds: new Map(),
    library: [],
    seenAt: 0,
    prefs: { types: {}, muted: {} },
  };
}

/** The inbox kind of a stored activity record, or null for kinds this page does not know. */
export function kindOf(item: ActivityItem): NotificationType | null {
  if (item.type === "deck" && item.ref === "updated") return "deckUpdated";
  if (["deckUpdated", "tryADeck"].includes(item.type) || !Object.hasOwn(TYPES, item.type))
    return null;
  return item.type as NotificationType;
}

export function visible(state: InboxState, now: number): NotificationItem[] {
  const out: NotificationItem[] = [];
  state.feeds.forEach((list, podId) => {
    if (state.prefs.muted[podId]) return;
    for (const item of list) {
      const kind = item ? kindOf(item) : null;
      if (!kind || item.by === state.uid) continue;
      if (Array.isArray(item.to) && item.to.length && !item.to.includes(state.uid || "")) continue;
      if (state.prefs.types[kind] === false) continue;
      if (!item.createdAt || now - item.createdAt > 30 * 86400000) continue;
      out.push({ ...item, type: kind });
    }
  });
  if (state.prefs.types.tryADeck !== false) {
    for (const item of state.library) {
      if (item.createdAt && now - item.createdAt <= 30 * 86400000) out.push(item);
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export function unreadCount(state: InboxState, now: number): number {
  return visible(state, now).filter((item) => item.createdAt > state.seenAt).length;
}

export function ago(ts: number, now: number): string {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + " h ago";
  const d = Math.round(h / 24);
  return d + (d === 1 ? " day ago" : " days ago");
}

/** The inbox item for a newly added Try-a-Deck deck. */
export function sampleItem(deck: {
  key: string;
  name: string;
  commander: string;
  addedAt: number;
}): NotificationItem {
  return {
    id: "try-a-deck-" + deck.key,
    podId: "",
    type: "tryADeck",
    by: "",
    byName: "Try a Deck",
    subject: deck.name + (deck.commander ? " (" + deck.commander + ")" : ""),
    ref: deck.key,
    createdAt: deck.addedAt,
  };
}

export function opensGathering(item: NotificationItem): boolean {
  return Boolean(
    item.ref && ["invite", "rsvp", "cancelled", "live", "gathering"].includes(item.type),
  );
}
