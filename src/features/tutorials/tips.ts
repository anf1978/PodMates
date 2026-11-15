// First-use tips: each shows once per device, the first time its feature appears. A tip triggers when its
// `when` element is on screen (usually a dialog's heading), when its `focus` field gets focus, or on an
// app event. Keep the text short and plain: browser translation reads it too.

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
  /** Outlined while the tip shows. */
  target?: string;
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
    when: ".export-title",
    title: "Export",
    text: "Copy the list in the format Moxfield or Archidekt expects, then paste it into their import box.",
  },
  {
    id: "tip-view-deck",
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
    event: "decks:saved",
    target: "#loadDeckBtn",
    title: "Saved",
    text: "Load a Deck brings it back on any device, and the Deck Log under the chart keeps its history. Tick the lock before saving to hide a deck from your pod.",
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
