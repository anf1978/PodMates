import type {
  ComboDetail,
  ManaCurveContributor,
  NearMissGroup,
  SynergyEdge,
  ThemeScore,
  TwoCardLoop,
} from "./types.ts";

/** The running totals `analyzeDeck` starts from; every count begins at zero. */
export function createDeckTallies() {
  return {
    totalCards: 0,
    landCount: 0,
    nonlandCount: 0,
    cmcSum: 0,
    ramp: 0,
    fastMana: 0,
    fastManaExtended: 0,
    draw: 0,
    removal: 0,
    wipe: 0,
    protection: 0,
    manaDork: 0,
    manaRock: 0,
    extraLand: 0,
    manaEnchantment: 0,
    treasureRamp: 0,
    ritual: 0,
    manaMultiplier: 0,
    untapper: 0,
    costReducer: 0,
    sacrificeMana: 0,
    landEngine: 0,
    castTriggerPayoff: 0,
    creatureEventPayoff: 0,
    // Castability-weighted counterparts of a few key raw counts, used
    // specifically for scoring -- the raw counts above stay untouched
    // (nothing displays them as a number directly, but a few internal
    // thresholds like Deck Craft's tutor check rely on the exact raw
    // count, so this stays additive rather than replacing anything).
    wipeWeighted: 0,
    removalWeighted: 0,
    tutorWeighted: 0,
    sacOutletsWeighted: 0,
    counterMagicWeighted: 0,
    staxWeighted: 0,
    discardWeighted: 0,
    mldWeighted: 0,
    punisherWeighted: 0,
    drawWeighted: 0,
    protectionWeighted: 0,
    rampWeighted: 0,
    reanimateWeighted: 0,
    extraTurnWeighted: 0,
    landBuffingWeighted: 0,
    manaMultiplierWeighted: 0,
    landEngineWeighted: 0,
    costReducerWeighted: 0,
    manaCurveContributors: [] as ManaCurveContributor[],
    counterMagic: 0,
    stax: 0,
    discard: 0,
    mld: 0,
    extraTurn: 0,
    tutor: 0,
    sac: 0,
    reanimate: 0,
    punisher: 0,
    altWinCards: [] as string[],
    millOpponentCount: 0,
    millSelfCount: 0,
    burnFaceCount: 0,
    infectCount: 0,
    gameChangers: [] as string[],
    bannedCards: [] as string[],
    typeFrequency: {} as Record<string, number>,
    cardsByType: {} as Record<string, { name: string; qty: number }[]>,
    detectedCombos: [] as string[],
    detectedComboDetails: [] as ComboDetail[],
    auraCount: 0,
    equipmentCount: 0,
    rampCards: [] as string[],
    fastManaCards: [] as string[],
    drawCards: [] as string[],
    tutorCards: [] as string[],
    protectionCards: [] as string[],
    staxCards: [] as string[],
    discardCards: [] as string[],
    counterCards: [] as string[],
    mldCards: [] as string[],
    reanimateCards: [] as string[],
    sacCards: [] as string[],
    manaCurve: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, "7+": 0 } as Record<string, number>,
    // Synergy / theme counts
    themes: {
      aristocrats: 0,
      tokens: 0,
      artifacts: 0,
      spellslinger: 0,
      graveyard: 0,
      drain: 0,
      lifegain: 0,
      landfall: 0,
      counters: 0,
      blink: 0,
      stax: 0,
      landBuffing: 0,
      minusCounters: 0,
      impulseDraw: 0,
      exileMatters: 0,
    },
    sacOutlets: 0,
    engines: 0,
    earlySpells: 0,
    freeInteraction: 0,
    cheapInteraction: 0,
    expensiveInteraction: 0,
    freeInteractionCards: [] as string[],
    // Pairwise synergy graph (from buildSynergyModel)
    synergyEdges: [] as SynergyEdge[],
    synergyEngineCards: [] as string[],
    synergyEngineCount: 0,
    synergyTopClusterSize: 0,
    commanderAlignment: 0,
    versatilityFeatures: 0,
    versatilityModes: 0,
    // Mana base: colored pips required (from nonland casting costs) vs colored
    // sources available (permanent mana producers, counted by source — not by
    // output amount — matching the standard "how many sources of a color do
    // you need" approach used in real deck-building math).
    manaPipsRequired: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 } as Record<string, number>,
    manaSourcesAvailable: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 } as Record<string, number>,
    manaSourceCards: {
      W: [] as string[],
      U: [] as string[],
      B: [] as string[],
      R: [] as string[],
      G: [] as string[],
      C: [],
    } as Record<string, string[]>,
    ritualCards: [] as string[],
    // Nonland cards with NO color identity at all -- Sol Ring, Mind
    // Stone, most equipment, etc. Deliberately separate from
    // manaPipsRequired.C above, which tracks the literal {C} mana symbol
    // specifically (rare -- Kozilek-style cards) for the Mana Base
    // panel's cost-vs-production comparison. A generic-cost card like
    // Sol Ring has no {C} symbol in its cost at all, so it was
    // contributing nothing to manaPipsRequired.C even though it's
    // exactly the kind of card a "colorless" count should include.
    colorlessNonlandCount: 0,
  };
}

export type DeckTallies = ReturnType<typeof createDeckTallies>;

/** The complete result of `analyzeDeck`. */
export interface DeckAnalysis extends DeckTallies {
  bannedCount: number;
  deckCardNames: string[];
  avgCmc: number;
  avgCmcLibrary: number;
  earlyDensity: number;
  engineRatio: number;
  themeScores: ThemeScore[];
  topThemes: ThemeScore[];
  redundancy: number;
  /** Spellbook lines found before the best SPELLBOOK_MAX_COMBOS were kept. */
  spellbookMatched: number;
  /** Two-card value loops: a Bracket signal only, never scored. Absent when there are none. */
  infiniteLoopTwoCard?: TwoCardLoop[];
  /** One-card-away combos (display only). */
  comboNear: NearMissGroup[];
  detectedLocks: { cards: string[]; outcome: string | null }[];
  detectedSynergies: string[];
  detectedSynergyDetails: { cards: string[] }[];
}
