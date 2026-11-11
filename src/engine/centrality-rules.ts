/** The kinds of commander support the investment half counts. */
export type SupportKind = "protection" | "recursion" | "tutor" | "costReducer" | "gear" | "direct";
export type SupportCounts = Record<SupportKind, number>;

// How central is the commander to this deck? Two halves:
//   (1) what the commander DOES for the deck -- how many combos it is part of,
//       how much of the synergy web hangs off it (tested by "ablation": take
//       the commander out and see how much of the web is left), and what kind
//       of ability it has (a repeating engine counts for more than a one-time
//       enters-the-battlefield effect);
//   (2) how much the builder has INVESTED in it -- protection, recursion,
//       tutors, cost reducers and gear beyond what a typical deck runs. A deck
//       packed with ways to keep its commander alive is telling you what the
//       builder thinks the deck is about. Only the EXCESS over a typical deck
//       counts, because plenty of protection (Swiftfoot Boots, Heroic
//       Intervention) is generic and shows up in every creature deck.
// Pure function: no page access. Returns data; the page draws it.

// How commanders work, as the scoring relies on it. Kept as data so the rules
// are in one place (and mirrored in the Product Bible). Checked against the
// Comprehensive Rules wording in Oct 2026 -- re-verify if the Commander rules
// change; the zone-return rules (903.9) are the part that has been revised before.
export const COMMANDER_RULES = [
  {
    key: "commandZone",
    rule: "A commander starts in the command zone. Its abilities do not work there unless they say so (Eminence does).",
    effect: "A commander whose ability works from the command zone needs less protecting.",
  },
  {
    key: "tax",
    rule: "Casting it from the command zone costs {2} more for each previous cast from the command zone. Casts from hand, graveyard or exile do not add tax.",
    effect:
      "A high-cost commander is cast fewer times, so a deck leaning on it is more exposed to removal.",
  },
  {
    key: "returnGyExile",
    rule: "If it goes to the graveyard or exile, its owner may move it to the command zone as a state-based action. (It does hit the graveyard first, so death triggers still happen.)",
    effect: "Removal costs the owner tempo, not the commander.",
  },
  {
    key: "returnHandLibrary",
    rule: "If it would go to hand or library, its owner may put it in the command zone instead (replacement effect).",
    effect: "Bounce and tutor-to-library effects are optional for the owner.",
  },
  {
    key: "damage",
    rule: "21 combat damage from the same commander eliminates a player.",
    effect: "Voltron-style plans rely on the commander surviving combat.",
  },
  {
    key: "identity",
    rule: "The commander's color identity defines which cards the deck may run.",
    effect: "The commander is always a deck-wide constraint, even when its ability barely matters.",
  },
  {
    key: "pairs",
    rule: "Partner, Partner with, Friends forever, Background and Doctor's companion allow two commanders; both count toward color identity.",
    effect: "With two commanders, the score looks at the pair together.",
  },
];

export const CENTRALITY_WEIGHTS = {
  plan: 0.25,
  engine: 0.25,
  alignment: 0.2,
  ability: 0.1,
  investment: 0.2,
};

// How much each kind of support counts toward "invested in the commander".
export const CENTRALITY_SUPPORT_WEIGHTS: Readonly<SupportCounts> = {
  protection: 1.0,
  recursion: 0.8,
  tutor: 0.5,
  costReducer: 0.6,
  gear: 0.4,
  direct: 1.5,
};

export const CENTRALITY_SUPPORT_LABELS: Readonly<Record<SupportKind, string>> = {
  protection: "Protection",
  recursion: "Recursion",
  tutor: "Tutors",
  costReducer: "Cost reducers",
  gear: "Equipment & Auras",
  direct: "Names your commander",
};

// Typical number of each kind of card across the 174 PodMates precon and curated decks (median; not the wider reference set). Re-fitted Nov 3, 2026.
export const CENTRALITY_SUPPORT_BASELINE: Readonly<SupportCounts> = {
  protection: 3,
  recursion: 0,
  tutor: 0,
  costReducer: 0,
  gear: 2,
  direct: 0,
};

// Typical support-card counts for each archetype: the median across the 174
// PodMates precon and curated decks, grouped by archetype (n = how many decks that is).
// Archetypes with few decks are blended toward the all-deck figure above,
// because a median of 3 or 4 decks is too easily thrown by one odd list.
export const CENTRALITY_SUPPORT_BASELINE_BY_ARCHETYPE: Readonly<
  Record<string, SupportCounts & { n: number }>
> = {
  Aristocrats: { n: 13, protection: 2, recursion: 1, tutor: 0, costReducer: 0, gear: 3, direct: 0 },
  "Artifacts Matter": {
    n: 13,
    protection: 4,
    recursion: 0,
    tutor: 0,
    costReducer: 0,
    gear: 2,
    direct: 0,
  },
  "Blink & ETB Value": {
    n: 5,
    protection: 4,
    recursion: 1,
    tutor: 0,
    costReducer: 0,
    gear: 1,
    direct: 0,
  },
  "Enchantments Matter": {
    n: 5,
    protection: 4,
    recursion: 1,
    tutor: 0,
    costReducer: 0,
    gear: 16,
    direct: 0,
  },
  "Goodstuff & Multicolor Value": {
    n: 11,
    protection: 3,
    recursion: 0,
    tutor: 0,
    costReducer: 0,
    gear: 2,
    direct: 0,
  },
  "Group Hug & Politics": {
    n: 5,
    protection: 6,
    recursion: 2,
    tutor: 0,
    costReducer: 0,
    gear: 5,
    direct: 0,
  },
  "Land Matters & Landfall": {
    n: 6,
    protection: 1.5,
    recursion: 0.0,
    tutor: 0.0,
    costReducer: 0.0,
    gear: 0.0,
    direct: 0.0,
  },
  "Mill & Self-Mill": {
    n: 5,
    protection: 3,
    recursion: 2,
    tutor: 0,
    costReducer: 0,
    gear: 3,
    direct: 0,
  },
  "Ramp & Big Creatures": {
    n: 14,
    protection: 3.5,
    recursion: 0.0,
    tutor: 0.0,
    costReducer: 0.0,
    gear: 2.5,
    direct: 0.0,
  },
  "Reanimator & Graveyard": {
    n: 12,
    protection: 2.0,
    recursion: 4.0,
    tutor: 0.0,
    costReducer: 0.0,
    gear: 2.0,
    direct: 0.0,
  },
  Spellslinger: {
    n: 14,
    protection: 0.5,
    recursion: 0.5,
    tutor: 0.0,
    costReducer: 0.5,
    gear: 1.5,
    direct: 0.0,
  },
  "Stax & Control": {
    n: 5,
    protection: 3,
    recursion: 0,
    tutor: 0,
    costReducer: 0,
    gear: 4,
    direct: 0,
  },
  "Tokens & Go-Wide": {
    n: 11,
    protection: 2,
    recursion: 0,
    tutor: 0,
    costReducer: 0,
    gear: 1,
    direct: 0,
  },
  "Tribal & Typal": {
    n: 34,
    protection: 2.0,
    recursion: 0.0,
    tutor: 0.0,
    costReducer: 0.0,
    gear: 2.0,
    direct: 0.0,
  },
  Voltron: { n: 21, protection: 4, recursion: 0, tutor: 0, costReducer: 0, gear: 3, direct: 0 },
};

export function centralityBaselineFor(archetype: string | null | undefined): {
  values: Readonly<SupportCounts>;
  label: string | null;
  n: number;
} {
  const a = archetype ? CENTRALITY_SUPPORT_BASELINE_BY_ARCHETYPE[archetype] : undefined;
  const weight = !a ? 0 : a.n >= 8 ? 1 : a.n >= 4 ? 0.5 : 0;
  if (!weight) return { values: CENTRALITY_SUPPORT_BASELINE, label: null, n: 0 };
  const values = {} as SupportCounts;
  for (const k of Object.keys(CENTRALITY_SUPPORT_BASELINE) as SupportKind[])
    values[k] = weight * (a![k] || 0) + (1 - weight) * CENTRALITY_SUPPORT_BASELINE[k];
  return { values, label: archetype as string, n: a!.n };
}

// Re-fitted Nov 3, 2026 on the 174 precon/curated decks (baselines above recomputed first): the cut-offs
// below give 24/44/22/10%. The 50 tuned + cEDH decks give 42% Self-sufficient, 32% Supported, 12% Reliant, 14% All-in.
export const CENTRALITY_BANDS = [
  { min: 0, label: "Self-sufficient", blurb: "The deck would mostly run without its commander." },
  {
    min: 27,
    label: "Supported",
    blurb: "The commander helps, but the deck has plenty going on without it.",
  },
  { min: 45, label: "Reliant", blurb: "Much of the deck's plan leans on the commander." },
  { min: 56, label: "All-in", blurb: "The deck is built around the commander." },
];

export function centralityShortName(name: string | null | undefined): string {
  return String(name || "")
    .split(",")[0]
    .trim();
}
