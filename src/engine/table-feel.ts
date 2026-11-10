import type { DeckAnalysis } from "./analyze-tallies.ts";
import type { WinCondition } from "./types.ts";
import { clamp } from "./axes/shared.ts";

// ---- Table Feel ----
// Player-archetype flavor for the Table Vibe box, keyed by the primary win
// condition's label (see detectWinCondition). Grounded in Mark Rosewater's
// canonical Timmy/Johnny/Spike psychographics — Timmy: big, dominant,
// memorable plays, motivated by fun over win-rate; Johnny: self-expression,
// wants to win on his own terms with his own deck, loves clever
// interactions; Spike: plays to win, cares about win-rate, adrenaline of
// outplaying someone. Most real players are hybrids, hence several
// two-name entries below. "Blorbo" (a 2026 community-coined, non-WotC-canon
// term) covers a genuinely different motivation entirely — collecting/
// playing for a specific character or vibe rather than gameplay — which
// shows up in a decklist as low power with no real synergy plan, not as
// any specific win condition.
export const TABLE_VIBE_ARCHETYPES: Readonly<
  Record<string, { label: string; you: string; pod: string }>
> = {
  "Voltron (commander damage)": {
    label: "Timmy/Spike",
    you: "You found the one big thing and you're marrying it.",
    pod: "A slow-building dread as your one creature quietly becomes unkillable and lethal.",
  },
  "Aristocrats / slow drain": {
    label: "Johnny",
    you: "You'd rather grind out an elegant machine than swing a big stick.",
    pod: "Death by a thousand cuts — nobody dies to any one thing, they just stop being at 40 life.",
  },
  "Direct damage (burn)": {
    label: "Timmy",
    you: "You want everyone to feel the same explosion at the same time.",
    pod: "Shared incineration. At least it's democratic.",
  },
  "Infinite combo": {
    label: "Johnny/Spike",
    you: "You found two cards nobody else was looking at and married them forever.",
    pod: "A completely normal game right up until it very suddenly isn't one anymore.",
  },
  "Known combo": {
    label: "Johnny/Spike",
    you: "You found two cards nobody else was looking at and married them forever.",
    pod: "A completely normal game right up until it very suddenly isn't one anymore.",
  },
  "Alternate win condition": {
    label: "Johnny",
    you: "Combat damage is for people with less imagination.",
    pod: "Confusion, then a rules lookup, then acceptance.",
  },
  "Extra turns": {
    label: "Spike/Johnny",
    you: "Why play one turn when you can play four?",
    pod: "Watching, from the sidelines, a lot.",
  },
  Mill: {
    label: "Johnny (the rogue)",
    you: "You'd rather out-think the format than out-punch it.",
    pod: "A slow, dawning horror as someone realizes their library is a rounding error.",
  },
  "Infect / Poison": {
    label: "Johnny/Timmy",
    you: "Ten is a much smaller number than forty and you noticed.",
    pod: "A single combat step that ends a game nobody saw coming.",
  },
};

// Pace: how SUDDENLY a deck ends the game, distinct from Speed (which only
// measures how fast a deck gets its engine running). Two decks can share a
// Speed score while having completely different relationships to time — a
// ramp-into-big-creatures deck telegraphs its threat over several turns,
// while a combo deck can end the game in one turn with no warning. This
// blends Speed with a "suddenness" weight keyed to the primary detected win
// condition, since that's the best available signal for how a deck's plan
// actually resolves once it's online.
export const SUDDENNESS_BY_WINCON: Readonly<Record<string, number>> = {
  "Infinite combo": 1.0,
  "Known combo": 0.85,
  "Voltron (commander damage)": 0.6,
  "Extra turns": 0.6,
  "Direct damage (burn)": 0.45,
  "Infect / Poison": 0.45,
  "Alternate win condition": 0.5,
  "Aristocrats / slow drain": 0.25,
  Mill: 0.15,
  "Combat damage (creature-based)": 0.3, // fallback: plain beatdown, gradual
};

export function computePace(
  speed: number,
  winCons: readonly WinCondition[] | null | undefined,
): number {
  // Use the MOST sudden win condition the deck has, not just the first one
  // listed — winCons[0] is ordering-dependent and tuned for "what's this
  // deck's headline identity" (Table Vibe, Style), a different question
  // from Pace's "how suddenly could this table's game actually end." A
  // deck whose primary label is something gradual but which also carries a
  // real combo line genuinely can end the game as fast as that combo
  // allows, regardless of which entry happens to sort first.
  let suddenness = 0.3; // fallback: plain beatdown, gradual
  if (winCons && winCons.length) {
    suddenness = Math.max(
      ...winCons.map((w) => {
        const s = SUDDENNESS_BY_WINCON[w.label];
        return s !== undefined ? s : 0.3;
      }),
    );
  }
  const suddennessScore = 1 + suddenness * 9; // map 0-1 onto the 1-10 scale
  const raw = speed * 0.55 + suddennessScore * 0.45;
  return clamp(Math.round(raw * 10) / 10);
}

export interface TableFeel {
  label: string;
  you: string;
  pod: string;
  why: string;
}

export function detectTableFeel(
  agg: DeckAnalysis,
  powerLevel: number,
  disruption: number,
  winCons: readonly WinCondition[] | null | undefined,
): TableFeel {
  // Stax dominates table feel regardless of the underlying win condition —
  // per Mark Rosewater himself, "griefer" (enjoys denying others' fun) is a
  // documented Timmy subtype, not a separate profile: the dominant play
  // isn't a creature, it's everyone else's turn not happening.
  if ((agg.stax || 0) >= 6 || (disruption >= 7 && (agg.stax || 0) >= 4)) {
    const cards =
      (agg.staxCards || []).slice(0, 5).join(", ") + ((agg.staxCards || []).length > 5 ? "…" : "");
    return {
      label: "Timmy (the griefer subtype)",
      you: "Your dominant play isn't a creature — it's everyone else's turn not happening.",
      pod: "The most legitimately divisive experience in Commander. Ask first.",
      why: `${agg.stax} stax effects detected (${cards}), pushing Disruption to ${disruption.toFixed(1)}.`,
    };
  }

  const primary = winCons && winCons[0] ? winCons[0].label : null;
  if (primary && TABLE_VIBE_ARCHETYPES[primary]) {
    return { ...TABLE_VIBE_ARCHETYPES[primary], why: winCons![0]!.detail };
  }

  // No specific archetype detected (the win-con fallback fired). A low
  // power level here means there's no real optimization plan either — this
  // is the "here for the vibes" deck, not a goodstuff pile that just
  // happens to lack a flashy finish.
  const engineDensity = agg.synergyEngineCount || 0;
  if (powerLevel <= 3 && engineDensity <= 4) {
    return {
      label: "Blorbo",
      you: "You're not here to win, you're here because you like your little guy.",
      pod: "A relaxed, low-stakes table where nobody's sweating — probably the best game of the night.",
      why: `Power Level sits at ${powerLevel.toFixed(1)} with only ${engineDensity} synergy engine card(s) detected — no specific win plan and minimal card-to-card interaction.`,
    };
  }

  return {
    label: "The honest generalist",
    you: "You just brought good cards and let them be good cards.",
    pod: "A normal game of Magic. Refreshing, honestly.",
    why: `No archetype-specific win condition or heavy stax signal detected, and Power Level (${powerLevel.toFixed(1)}) is high enough that this doesn't read as a low-effort pile either.`,
  };
}

// Export for use in main app
