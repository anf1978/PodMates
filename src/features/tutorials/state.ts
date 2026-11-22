// Tutorials: which tips this device has seen, and the first-chart tour's steps (no DOM work here).

export interface TipsState {
  /** Tip and tour ids already finished or skipped on this device. */
  seen: string[];
  /** All tips switched off from Help & tips. */
  off: boolean;
}

export const STORAGE_KEY = "pm_tips";
/** "Later" hides the welcome for the rest of this visit only. */
export const LATER_KEY = "pm_tips_later";
export const WELCOME = "welcome";
export const TOUR = "tour-first-chart";

export function parseTips(raw: string | null): TipsState {
  try {
    const value = raw ? (JSON.parse(raw) as Partial<TipsState>) : {};
    return {
      seen: Array.isArray(value.seen) ? value.seen.filter((id) => typeof id === "string") : [],
      off: value.off === true,
    };
  } catch {
    return { seen: [], off: false };
  }
}

export const shouldWelcome = (tips: TipsState, later: boolean): boolean =>
  !tips.off && !later && !tips.seen.includes(WELCOME);

export const markSeen = (tips: TipsState, id: string): TipsState =>
  tips.seen.includes(id) ? tips : { ...tips, seen: [...tips.seen, id] };

/** A control whose icon the card shows next to its name (copied from the page). */
export interface IconRef {
  from: string;
  label: string;
}

/** How a tour step moves on: by an app event, or by the visitor tapping Next. */
export type Advance = "samples:chosen" | "chart:done" | "next";

export interface TourStep {
  id: string;
  /** CSS selector of what the step points at (highlighted and scrolled into view). Missing or
   * hidden targets are skipped. */
  target: string | null;
  title: string;
  text: string;
  advance: Advance;
  /** Icons shown in the card, so phone users can match them to the buttons. */
  icons?: IconRef[];
  /** Outline the target's whole row (its parent) instead of the target. */
  outlineParent?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "pick",
    target: "#sampleBtn",
    title: "Pick a deck",
    text: "Tap Try a Deck and choose any precon. It loads into the form.",
    advance: "samples:chosen",
    icons: [{ from: "#sampleBtn", label: "Try a Deck" }],
  },
  {
    id: "chart",
    target: "#chartBtn",
    title: "Chart it",
    text: "Now tap Chart Deck.",
    advance: "chart:done",
  },
  {
    id: "radar",
    target: "#chartArea",
    title: "The deck's profile",
    text: "Five scores from 1 to 10: Speed, Consistency, Versatility, Disruption and Power Level. The percentages compare it with precons, tuned decks and cEDH lists.",
    advance: "next",
  },
  {
    id: "spark",
    target: "#chartArea",
    title: "Command Spark",
    text: "One number from the five scores, used to line up a fair table. Decks with close Sparks make even games. Tap it for the details.",
    advance: "next",
  },
  {
    id: "bracket",
    target: "#bracketArea",
    title: "Bracket",
    text: "The official Commander Bracket the cards point to: Game Changers, combos, extra turns.",
    advance: "next",
  },
  {
    id: "closest",
    target: "#archetypeMatchCallout",
    title: "Closest match",
    text: "The official precon this deck plays most like.",
    advance: "next",
  },
  {
    id: "combos",
    target: "#keyPiecesPanel",
    title: "Key pieces and combos",
    text: "Combos the deck can put together, and how they win. Tap any panel heading to open it.",
    advance: "next",
  },
  {
    id: "legality",
    target: "#legalityPanel",
    title: "Structure and legality",
    text: "Deck size, colour identity and banned cards.",
    advance: "next",
  },
  {
    id: "log",
    target: "#deckLogPanel",
    title: "Deck Log",
    text: "Save a deck and its history lives here: charts, battles, wins and card changes.",
    advance: "next",
  },
  {
    id: "tools",
    target: "#chartBtn",
    title: "Deck tools",
    text: "The buttons next to Chart Deck:",
    advance: "next",
    outlineParent: true,
    icons: [
      { from: "#viewDeckBtn", label: "View Deck: every card with art" },
      { from: "#exportDeckBtn", label: "Export for Moxfield or Archidekt" },
      { from: "#sampleBtn", label: "Try a Deck" },
      { from: "#saveDeckBtn", label: "Save Deck" },
      { from: ".icon-checkbox-label .icon-locked", label: "Keep secret from your pod" },
      { from: "#loadDeckBtn", label: "Load a Deck" },
      { from: "#clearBtn", label: "Clear the form (asks first if the deck isn't saved)" },
    ],
  },
  {
    id: "done",
    target: null,
    title: "That's the tour",
    text: "Paste your own list, import one from Moxfield or Archidekt, or build one in Deck Crafter. The ? button replays this tour.",
    advance: "next",
  },
];
