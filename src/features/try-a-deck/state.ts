// Pure library navigation; dataset loading and the page's deck form stay outside this state.
export interface SampleDeck {
  key: string;
  source: string;
  style: string;
  archetype: string;
  archetypeAlso?: string[];
  year?: number;
  setName?: string;
  flavorName: string;
  tagline: string;
  commander: string;
  decklist: string;
}

export type Location =
  | { view: "home" | "archetype-list" | "style-list" | "year-list" }
  | { view: "archetype-decks"; archetype: string }
  | { view: "style-decks"; style: string }
  | { view: "set-list"; year: number }
  | { view: "set-decks"; year: number; setName: string };

export interface Navigation {
  current: Location;
  history: Location[];
}

export function initialNavigation(): Navigation {
  return { current: { view: "home" }, history: [] };
}

export function navigate(state: Navigation, current: Location): Navigation {
  return { current, history: [...state.history, state.current] };
}

export function back(state: Navigation): Navigation {
  const current = state.history.at(-1);
  return current ? { current, history: state.history.slice(0, -1) } : state;
}

export const ARCHETYPE_BLURBS: Record<string, string> = {
  Voltron: "Load one creature down with counters, Auras, or Equipment and swing for the win.",
  Aristocrats:
    "Sacrifice creatures for value, draining life and refilling your hand along the way.",
  Spellslinger:
    "Chain instants and sorceries for copy effects, storm, and spell-triggered payoffs.",
  "Ramp & Big Creatures": "Accelerate mana early, then close the game with oversized threats.",
  "Tribal & Typal": "Lean on a shared creature type for anthem effects and typal payoffs.",
  "Reanimator & Graveyard":
    "Fill the graveyard fast, then cheat your biggest threats into play early.",
  "Artifacts Matter":
    "Build around artifact synergies, cost reducers, and colorless value engines.",
  "Tokens & Go-Wide": "Flood the board with token creatures and finish with anthems or mass pump.",
  "Goodstuff & Multicolor Value":
    "A high-power pile of efficient, on-color staples without a single tight theme.",
  "Land Matters & Landfall":
    "Trigger landfall and land-based payoffs by playing extra lands each turn.",
  "Enchantments Matter": "Stack Auras and enchantments for constellation-style triggers and buffs.",
  "Stax & Control": "Slow the game down with taxes, wraths, and resource denial.",
  "Group Hug & Politics": "Share resources or manipulate the table's alliances instead of racing.",
  "Blink & ETB Value":
    "Flicker creatures in and out of play to double up on enter-the-battlefield triggers.",
  "Mill & Self-Mill":
    "Put cards from library to graveyard, yours or theirs, to fuel the rest of the plan.",
};

export function archetypes(decks: readonly SampleDeck[]): string[] {
  const present = new Set(decks.map((deck) => deck.archetype));
  return Object.keys(ARCHETYPE_BLURBS).filter((name) => present.has(name));
}

export function styles(decks: readonly SampleDeck[]): string[] {
  return [...new Set(decks.map((deck) => deck.style))].sort();
}

export function preconYears(decks: readonly SampleDeck[]): number[] {
  return [
    ...new Set(
      decks
        .filter((deck) => deck.source === "precon")
        .map((deck) => deck.year)
        .filter((year): year is number => year !== undefined),
    ),
  ].sort((a, b) => a - b);
}

export function decksAt(decks: readonly SampleDeck[], location: Location): SampleDeck[] {
  return decks.filter((deck) => {
    switch (location.view) {
      case "archetype-decks":
        return deck.archetype === location.archetype;
      case "style-decks":
        return deck.style === location.style;
      case "set-decks":
        return (
          deck.source === "precon" &&
          deck.year === location.year &&
          deck.setName === location.setName
        );
      default:
        return false;
    }
  });
}
