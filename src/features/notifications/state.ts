// Device-local inbox state and pure activity filtering; never sends email or push alerts.
import type { ActivityItem } from "../../services/cloud/activity";
import type { PodDoc, WithId } from "../../services/cloud/types";

export const TYPES = {
  deck: {
    label: "A podmate charts a new deck",
    tag: "Deck",
    text: (n: string, s?: string) => n + " charted a new deck" + (s ? ": " + s : ""),
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
  seenAt: number;
  prefs: Preferences;
}

export function initialState(): InboxState {
  return { uid: null, pods: [], feeds: new Map(), seenAt: 0, prefs: { types: {}, muted: {} } };
}

function isKnown(item: ActivityItem): item is NotificationItem {
  return Object.hasOwn(TYPES, item.type);
}

export function visible(state: InboxState, now: number): NotificationItem[] {
  const out: NotificationItem[] = [];
  state.feeds.forEach((list, podId) => {
    if (state.prefs.muted[podId]) return;
    for (const item of list) {
      if (!item || !isKnown(item) || item.by === state.uid) continue;
      if (Array.isArray(item.to) && item.to.length && !item.to.includes(state.uid || "")) continue;
      if (state.prefs.types[item.type] === false) continue;
      if (!item.createdAt || now - item.createdAt > 30 * 86400000) continue;
      out.push(item);
    }
  });
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

export function opensGathering(item: NotificationItem): boolean {
  return Boolean(
    item.ref && ["invite", "rsvp", "cancelled", "live", "gathering"].includes(item.type),
  );
}
