// First-use tips: each shows once per device, the first time its feature appears. A tip triggers when its
// `when` element is on screen (usually a dialog's heading), when its `focus` field gets focus, or on an
// app event. Keep the text short and plain: browser translation reads it too.

import type { IconRef } from "./state";

export type TipEvent = "decks:saved";

export interface Tip {
  id: string;
  title: string;
  text: string;
  /** Shown while this element is on screen; closes (as seen) when it goes away. */
  when?: string;
  /** Shown when this field gets focus. */
  focus?: string;
  /** Shown on this app event. */
  event?: TipEvent;
  /** Outlined (and scrolled into view) while the tip shows. */
  target?: string;
  /** Icons shown in the card, so phone users can match them to the buttons. */
  icons?: IconRef[];
}

export const TIPS: readonly Tip[] = [
  {
    id: "tip-paste",
    focus: "#decklistInput",
    title: "Paste a decklist",
    text: "One card per line, like 1 Sol Ring. Moxfield and Archidekt exports work as they are. Leave Commander empty and PodMates finds it.",
  },
  {
    id: "tip-import",
    focus: "#deckLinkInput",
    target: "#deckLinkLoadBtn",
    title: "Import a deck",
    text: "Paste a public Moxfield or Archidekt deck link and tap Load. Tick Keep synced to follow later changes.",
  },
  {
    id: "tip-crafter",
    when: ".db-heading",
    title: "Deck Crafter",
    text: "Search for cards and add them. Pick your commander first and searches stay in its colours. Your draft is kept on this device.",
  },
  {
    id: "tip-scan",
    when: ".scan-title",
    title: "Scan cards",
    text: "Add a photo of your cards. PodMates reads the names. Untick any it got wrong, then add the rest.",
  },
  {
    id: "tip-export",
    icons: [{ from: "#exportDeckBtn", label: "Export" }],
    when: ".export-title",
    title: "Export",
    text: "Copy the list in the format Moxfield or Archidekt expects, then paste it into their import box.",
  },
  {
    id: "tip-view-deck",
    icons: [{ from: "#viewDeckBtn", label: "View Deck" }],
    when: ".cv-title",
    title: "View Deck",
    text: "Every card in the deck with its art. Tap a card to see it larger.",
  },
  {
    id: "tip-card",
    when: "#singleCardArtArea",
    title: "Card view",
    text: "Tap any card name in PodMates to see the card like this.",
  },
  {
    id: "tip-load",
    icons: [{ from: "#loadDeckBtn", label: "Load a Deck" }],
    when: "#loadDeckListArea",
    title: "Load a Deck",
    text: "Your saved decks and your podmates' shared ones. Tap a deck to load it, then Chart Deck.",
  },
  {
    id: "tip-account",
    when: ".auth-title",
    title: "Why an account?",
    text: "An account keeps your saved decks, pods and Deck Logs on any device. Charting stays free without one.",
  },
  {
    id: "tip-saved",
    icons: [
      { from: "#loadDeckBtn", label: "Load a Deck" },
      { from: ".icon-checkbox-label .icon-locked", label: "Keep secret" },
    ],
    event: "decks:saved",
    target: "#loadDeckBtn",
    title: "Saved",
    text: "Load a Deck brings it back on any device, and the Deck Log under the chart keeps its history. Tick the lock before saving to hide a deck from your pod.",
  },
  {
    id: "tip-profile",
    when: ".profile-title",
    title: "My Profile",
    text: "Set your display name, link Moxfield or Archidekt decks to keep them in sync, and download a backup of your decks under My Data.",
  },
  {
    id: "tip-mypods",
    when: "#podMode",
    title: "MyPods",
    text: "Your playgroups. Create a pod or join one with an invite link. No pod yet? Try Sample a Gathering.",
  },
  {
    id: "tip-pod",
    when: ".pods-title",
    title: "Your pod",
    text: "Members, the invite link and game nights. The Full Ledger lists every deck your pod shares.",
  },
  {
    id: "tip-host",
    when: "#hostSeatsArea",
    title: "Host a Gathering",
    text: "Pick a time, invite podmates and add guests. Everyone chooses a deck for their seat.",
  },
  {
    id: "tip-gathering",
    when: "#gatheringSeatsArea",
    title: "Gathering",
    text: "Each seat gets a player and a deck. Chart the table to see how even it is, then log the battle.",
  },
  {
    id: "tip-comparison",
    when: "#podRankArea",
    title: "Pod Comparison",
    text: "Decks ranked by Command Spark. Close Sparks make a fairer game. Tap a deck for its details.",
  },
  {
    id: "tip-chronicles",
    when: ".chronicles-dialog-heading",
    title: "Chronicles",
    text: "Rate the battle and add notes. Your pod's history and each deck's battle count build from these.",
  },
  {
    id: "tip-impact",
    when: ".impact-title",
    title: "Impact cards",
    text: "High-impact cards your pod watches. Pod changes only affect the separate Pod view line, never the main scores.",
  },
  {
    id: "tip-spoilers",
    when: ".sb-heading",
    title: "Spoiler Bait",
    text: "Vote on new cards: Bang or Bin. Your pod's board shows everyone's votes.",
  },
  {
    id: "tip-bell",
    icons: [{ from: "#pmBellBtn", label: "Notifications" }],
    when: ".pm-notif-title",
    title: "Notifications",
    text: "What's new in your pods. Choose what to hear about under What to tell me about.",
  },
  {
    id: "tip-player",
    when: "#playerProfileContent .pp-header",
    title: "Player profile",
    text: "A podmate's style at a glance: colours, card types and play style from their shared decks.",
  },
  {
    id: "tip-pod-profile",
    when: "#podProfileContent .pp-header",
    title: "Pod profile",
    text: "The whole pod at a glance. Tap a dot in the pace chart to chart that deck.",
  },
  {
    id: "tip-deck-preview",
    when: ".pp-deck-preview .pp-deck-stats",
    title: "Deck preview",
    text: "A deck at a glance. Chart this deck for the full analysis.",
  },
];

export interface TipMatch {
  tip: Tip;
  /** The on-screen element that triggered a `when` tip (null for focus and event tips). */
  el: HTMLElement | null;
}

const onScreen = (el: Element | null): el is HTMLElement =>
  !!el && el.isConnected && (el as HTMLElement).getClientRects().length > 0;

/** The first unseen tip that applies now: a focused field, an app event, or an element on screen. */
export function findTip(
  seen: readonly string[],
  context: { focus?: EventTarget | null; event?: TipEvent } = {},
  tips: readonly Tip[] = TIPS,
): TipMatch | null {
  for (const tip of tips) {
    if (seen.includes(tip.id)) continue;
    if (tip.focus && context.focus instanceof Element && context.focus.matches(tip.focus))
      return { tip, el: null };
    if (tip.event && tip.event === context.event) return { tip, el: null };
    if (tip.when) {
      const el = document.querySelector(tip.when);
      if (onScreen(el)) return { tip, el };
    }
  }
  return null;
}

/** A `when` tip's element has gone (its dialog closed). */
export const tipGone = (match: TipMatch): boolean => !!match.tip.when && !onScreen(match.el);
