// Default "impact cards": cards that are near-universal in competitive (cEDH)
// lists yet almost never appear in precons or tuned Bracket 4 decks. They are
// found by frequency across the reference decks (>= 7 of 20 cEDH lists, at
// most 2 of 30 tuned lists and at most 1 precon) and are NOT Game Changers, so
// they add signal the Game Changer count cannot see. Fitted Oct 12, 2026 on the October reference lists;
// not re-fitted when the reference decks were re-sourced (055): against today's 20 cEDH lists, seven sit
// below 7 of 20 and Lotus Petal is in 7 of 30 tuned lists. Re-fitting moves Power: an /engine-change. Pods can propose their own
// list; that only ever feeds the separate "Pod view" Power figure, never the
// standard radar, Spark or bands.
export const DEFAULT_IMPACT_CARDS: readonly string[] = [
  "Gemstone Caverns",
  "Mox Amber",
  "Mox Opal",
  "Lotus Petal",
  "Pact of Negation",
  "Mental Misstep",
  "Simian Spirit Guide",
  "Elvish Spirit Guide",
  "Flusterstorm",
  "Ragavan, Nimble Pilferer",
  "Mindbreak Trap",
  "Rite of Flame",
  "Cabal Ritual",
  "Borne Upon a Wind",
  "Red Elemental Blast",
  "Pyroblast",
  "Chain of Vapor",
  "Misdirection",
  "Redirect Lightning",
  "Silence",
  "Tainted Pact",
  "Demonic Consultation",
  "Final Fortune",
  "Brain Freeze",
  "Beseech the Mirror",
  "Wishclaw Talisman",
  "Vexing Bauble",
  "Wheel of Fortune",
];
