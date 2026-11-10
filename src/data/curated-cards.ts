// ============================================================
// DECK COMPASS — Classification & Scoring Engine
// ============================================================

// ---- Curated supplement: genuine stax/tax/prison effects that don't share
// a common enough template to safely regex-match without false positives.
// Compiled by hand-reviewing community stax reference lists against this
// database's classification output, then scanning for similarly-templated
// cards elsewhere in the 32k-card set. Organized by pillar (taxes,
// tap/untap denial, sacrifice/attrition, restriction/hatebears, plus the
// lifegain-denial and draw-disruption families that recurred often enough
// to group on their own).
// Curated supplement for the "Sudden Game Over Effects" family (combat
// damage causes the opponent to lose the game) whose trigger text crosses
// a sentence boundary and doesn't fit the bounded-gap regex above safely.
export const CURATED_ALT_WIN_COMBAT_DAMAGE: ReadonlySet<string> = new Set([
  "Etrata, the Silencer",
  "Atemsis, All-Seeing",
  "Angel of Destiny",
  "Ramses, Assassin Lord",
]);

// Fast mana: deliberately a curated set, not a regex heuristic. "Fast mana"
// is a specific, historically-grounded semantic category (WotC's own 2003
// R&D definition: cards that produce more mana than they cost, available
// immediately) — a CMC/type-based rule can't capture it without either
// missing whole categories (rituals, Spirit Guide creatures, Sol Lands all
// fail a naive "artifact/land only" filter) or drowning it in noise
// (ordinary mana dorks and rocks aren't fast mana just because they
// accelerate). Core = unambiguous fast mana by the strict definition.
// Extended = cards reasonably called fast mana in community discussion but
// conditional/deck-dependent enough that they shouldn't carry full weight
// (e.g. Bloom Tender needs a specific board state; Smothering Tithe is
// real acceleration but opponent-dependent, not a guaranteed burst).
// Phyrexian Tower deliberately excluded from both tiers on audit: unlike
// the "depletion land" cycle (Peat Bog, Remote Farm, etc.), which sacrifice
// THEMSELVES for a one-time double-mana burst, Phyrexian Tower sacrifices a
// separate CREATURE while the land persists and reverts to an ordinary
// 1-mana land afterward -- net +1 mana on that one activation, nowhere
// near "produces more mana than it cost." A real deckbuilder primer for a
// deck explicitly built around avoiding fast mana still ran this land,
// confirming it isn't perceived as fast mana in practice either.
export const CURATED_FAST_MANA: ReadonlySet<string> = new Set([
  "Ancient Spring",
  "Ancient Tomb",
  "Basalt Monolith",
  "Black Lotus",
  "Bubbling Muck",
  "Burgeoning",
  "Burnt Offering",
  "Cabal Ritual",
  "Culling the Weak",
  "Channel",
  "Chancellor of the Tangle",
  "Chrome Mox",
  "City of Traitors",
  "Crystal Vein",
  "Dark Ritual",
  "Desperate Ritual",
  "Dockside Extortionist",
  "Dwarven Ruins",
  "Ebon Stronghold",
  "Eldrazi Temple",
  "Elvish Spirit Guide",
  "Fastbond",
  "Gaea's Cradle",
  "Gemstone Caverns",
  "Geosurge",
  "Geothermal Crevice",
  "Grim Monolith",
  "Hickory Woodlot",
  "Infernal Plunge",
  "Irencrag Feat",
  "Jeska's Will",
  "Jeweled Lotus",
  "Lake of the Dead",
  "Lion's Eye Diamond",
  "Lotus Bloom",
  "Lotus Petal",
  "Mana Crypt",
  "Mana Vault",
  "Metalworker",
  "Mishra's Workshop",
  "Mox Amber",
  "Mox Diamond",
  "Mox Emerald",
  "Mox Jasper",
  "Mox Jet",
  "Mox Opal",
  "Mox Pearl",
  "Mox Ruby",
  "Mox Sapphire",
  "Mox Tantalite",
  "Orcish Lumberjack",
  "Peat Bog",
  "Pyretic Ritual",
  "Rain of Filth",
  "Remote Farm",
  "Rite of Flame",
  "Rofellos, Llanowar Emissary",
  "Ruins of Trokair",
  "Sacrifice",
  "Sandstone Needle",
  "Saprazzan Skerry",
  "Scorched Ruins",
  "Seething Song",
  "Serra's Sanctum",
  "Simian Spirit Guide",
  "Sol Ring",
  "Songs of the Damned",
  "Svyelunite Temple",
  "Tinder Farm",
  "Tinder Wall",
  "Tolarian Academy",
  "Treasonous Ogre",
  "Untaidake, the Cloud Keeper",
  "Wild Cantor",
  "_____ Goblin",
]);

export const CURATED_FAST_MANA_EXTENDED: ReadonlySet<string> = new Set([
  "Ashnod's Altar",
  "Battle Hymn",
  "Bloom Tender",
  "Cabal Coffers",
  "Cabal Stronghold",
  "Crypt Ghast",
  "Food Chain",
  "High Tide",
  "Karametra's Acolyte",
  "Mana Drain",
  "Mana Geyser",
  "Mana Seism",
  "Nykthos, Shrine to Nyx",
  "Nyx Lotus",
  "Open the Omenpaths",
  "Priest of Titania",
  "Priest of Yawgmoth",
  "Runaway Steam-Kin",
  "Sanctum Weaver",
  "Selvala, Heart of the Wilds",
  "Smothering Tithe",
  "Storm the Vault // Vault of Catlacan",
  "Squandered Resources",
  "Strike It Rich",
  "Utopia Sprawl",
  "Wild Growth",
  "Lotus Vale",
]);

// Untap effects are only ramp when they realistically generate additional
// mana (untapping a mana-producing permanent) — not every "untap target
// creature" effect qualifies, so this stays a curated list rather than a
// blanket rule on top of the generic untapper subtag pattern.
export const CURATED_RAMP_UNTAPPERS: ReadonlySet<string> = new Set([
  "Voltaic Key",
  "Dramatic Reversal",
  "Seedborn Muse",
  "Kiora's Follower",
  "Voyaging Satyr",
  "Wilderness Reclamation",
  "Freed from the Real",
  "Sword of the Paruns",
  "Fatestitcher",
  "Aphetto Alchemist",
]);

export const CURATED_STAX: ReadonlySet<string> = new Set([
  // Genuinely persistent/recurring restrictions only -- one-shot, single-
  // turn effects (a one-time edict sorcery, an instant that locks something
  // down "until end of turn," a creature ability that sacrifices itself for
  // a one-time effect) don't belong here even if they resemble stax
  // effects, since they're a single interaction rather than an ongoing
  // board-state restriction. Removed on review: Price of Progress (no
  // restriction at all, just direct damage), Hallowed Moonlight and Pale
  // Moon (one-shot instants), Mistcaller (self-sacrificing, one-time use).
  // Kept despite mentioning "this turn" elsewhere in their text: Sen
  // Triplets, Fatespinner, Chaos Moon (recur every upkeep indefinitely,
  // each application just happens to only last one turn), Ethersworn
  // Canonist, Damping Engine, Damping Sphere (the "this turn" language is
  // an incidental once-per-turn qualifier on an otherwise fully persistent
  // restriction, not a duration limit on the restriction itself).
  // --- Taxes / pay-or-suffer ---
  "Ancient Runes",
  "Black Vise",
  "Iron Maiden",
  "Dark Suspicions",
  "Shrieking Affliction",
  "Storm World",
  "Primal Order",
  "Rug of Smothering",
  "Phyrexian Tyranny",
  "Catalyst Stone",
  "Champions of Minas Tirith",
  "Brand of Ill Omen",
  "Breath of Dreams",
  "Brutal Suppression",
  "Talion, the Kindly Lord",
  "Vile Consumption",
  "Defense Grid",
  "Curse of Fool's Wisdom",
  "Ob Nixilis, Unshackled",
  "Confounding Conundrum",
  "Price of Glory",
  "Zo-Zu the Punisher",
  "Monsoon",
  "Mana Web",
  "Tectonic Instability",
  "War's Toll",
  "Vorinclex, Voice of Hunger",
  // --- Tap / untap denial ---
  "Tsabo's Web",
  "Storage Matrix",
  // --- Sacrifice / attrition ---
  "Keldon Twilight",
  "Stoneshaker Shaman",
  "Nature's Wrath",
  "Tainted Aether",
  "Kudzu",
  "Burning Sands",
  "Vicious Shadows",
  "Lethal Vapors",
  // --- Restriction / hatebears ---
  "Ensnaring Bridge",
  "Moat",
  "Trinisphere",
  "Land Equilibrium",
  "Sanctum Prelate",
  "Spirit of the Labyrinth",
  "Teferi, Mage of Zhalfir",
  "Teferi, Time Raveler",
  "City of Solitude",
  "Dosan the Falling Leaf",
  "Sen Triplets",
  "Opposition Agent",
  "Containment Priest",
  "Tocatli Honor Guard",
  "Torpor Orb",
  "Doorkeeper Thrull",
  "Karlov Watchdog",
  "Katabatic Winds",
  "Kulrath Knight",
  "Storm, Windrider",
  "Dense Canopy",
  "Song of Serenity",
  "Queen Mother Ramonda",
  "Pramikon, Sky Rampart",
  "Uphill Battle",
  "Orb of Dreams",
  "False Floor",
  "Stormtide Leviathan",
  "Toxicrene",
  "Titania's Song",
  "Suncleanser",
  "Vorinclex, Monstrous Raider",
  "Portcullis",
  "Fatespinner",
  "Noetic Scales",
  "Teferi's Realm",
  "Disciple of Caelus Nin",
  "Gaddock Teeg",
  "Ethersworn Canonist",
  "Exiled Doomsayer",
  "Damping Engine",
  "Damping Sphere",
  "Nether Void",
  "In the Eye of Chaos",
  "Presence of the Master",
  "Island Sanctuary",
  "Naked Singularity",
  "Reality Twist",
  "Ritual of Subdual",
  "Chaos Moon",
  "Quarum Trench Gnomes",
  // --- Lifegain / life-total denial ("hosers") ---
  "Rain of Gore",
  "Tainted Remedy",
  "Plague Drone",
  "Stigma Lasher",
  // --- Card-advantage denial / draw disruption ---
  "Uba Mask",
  "Zur's Weirding",
  "Shared Fate",
  "Sheoldred, the Apocalypse",
  "Scrawling Crawler",
  "Kambal, Consul of Allocation",
  "Havoc",
  "Liesa, Shroud of Dusk",
  "Aura Flux",
]);

// Free / pitch interaction (high-impact stack answers)
export const FREE_INTERACTION_NAMES: readonly string[] = [
  "Force of Will",
  "Force of Negation",
  "Force of Vigor",
  "Misdirection",
  "Fierce Guardianship",
  "Deflecting Swat",
  "Deadly Rollick",
  "Flawless Maneuver",
  "Pact of Negation",
  "Mental Misstep",
  "Mindbreak Trap",
  "Flusterstorm",
  "Pyroblast",
  "Red Elemental Blast",
  "Veil of Summer",
  "Autumn's Veil",
  "Swan Song",
  "Spell Pierce",
  "Stubborn Denial",
  "An Offer You Can't Refuse",
];
