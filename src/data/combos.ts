/** A curated combo or synergy: every slot needs one of its alternatives in the deck. */
export interface CuratedCombo {
  /** Slots of alternative card names. */
  s: string[][];
  /** Outcome text. */
  o?: string | null;
  /** Kind: "infinite_combo", "combo", "synergy" or "lock". */
  t: string;
}

// Known combo/synergy database: merged from a curated hand-picked list plus a
// cleaned extraction from the long-running MTG Salvation "Infinite Combos and
// Strong Synergies" community thread. Each combo's card names are verified
// against the real card database (every name here resolves to an actual
// Scryfall oracle name). Structure: slots = AND of OR-groups — every slot
// needs at least one of its alternatives present for the combo to match.
// HARD_COMBOS (infinite/game-ending) drive Bracket, Power Level, and the Win
// Condition callout. SOFT_SYNERGIES (type: synergy/lock) are informational
// only — real, useful interactions that aren't a hard combo trigger, shown in
// the Synergy Profile panel instead.
export const HARD_COMBOS: readonly CuratedCombo[] = [
  { s: [["Thassa's Oracle"], ["Demonic Consultation"]], o: "deck-out win", t: "infinite_combo" },
  { s: [["Thassa's Oracle"], ["Tainted Pact"]], o: "deck-out win", t: "infinite_combo" },
  { s: [["Isochron Scepter"], ["Dramatic Reversal"]], o: "infinite mana", t: "infinite_combo" },
  {
    s: [["Kiki-Jiki, Mirror Breaker"], ["Zealous Conscripts"]],
    o: "infinite combat",
    t: "infinite_combo",
  },
  { s: [["Kiki-Jiki, Mirror Breaker"], ["Pestermite"]], o: "infinite combat", t: "infinite_combo" },
  {
    s: [["Kiki-Jiki, Mirror Breaker"], ["Deceiver Exarch"]],
    o: "infinite combat",
    t: "infinite_combo",
  },
  {
    s: [["Splinter Twin"], ["Deceiver Exarch"]],
    o: "infinite combat via untap-creature combo",
    t: "infinite_combo",
  },
  { s: [["Splinter Twin"], ["Pestermite"]], o: "infinite combat", t: "infinite_combo" },
  { s: [["Heliod, Sun-Crowned"], ["Walking Ballista"]], o: "infinite damage", t: "infinite_combo" },
  { s: [["Basalt Monolith"], ["Rings of Brighthearth"]], o: "infinite mana", t: "infinite_combo" },
  { s: [["Deadeye Navigator"], ["Peregrine Drake"]], o: "infinite mana", t: "infinite_combo" },
  { s: [["Palinchron"], ["Phantasmal Image"]], o: "infinite mana", t: "infinite_combo" },
  { s: [["Grand Architect"], ["Pili-Pala"]], o: "infinite mana", t: "infinite_combo" },
  {
    s: [["Najeela, the Blade-Blossom"], ["Nature's Will"]],
    o: "infinite combat",
    t: "infinite_combo",
  },
  {
    s: [["Najeela, the Blade-Blossom"], ["Druids' Repository"]],
    o: "infinite combat",
    t: "infinite_combo",
  },
  {
    s: [["Dockside Extortionist"], ["Temur Sabertooth"]],
    o: "infinite treasures",
    t: "infinite_combo",
  },
  {
    s: [["Dockside Extortionist"], ["Emiel the Blessed"]],
    o: "infinite treasures",
    t: "infinite_combo",
  },
  { s: [["Sanguine Bond"], ["Exquisite Blood"]], o: "infinite life drain", t: "infinite_combo" },
  { s: [["Mikaeus, the Unhallowed"], ["Triskelion"]], o: "infinite damage", t: "infinite_combo" },
  {
    s: [["Ashnod's Altar"], ["Nim Deathmantle"]],
    o: "infinite mana/death triggers",
    t: "infinite_combo",
  },
  { s: [["Food Chain"], ["Squee, the Immortal"]], o: "infinite mana", t: "infinite_combo" },
  {
    s: [["Underworld Breach"], ["Lion's Eye Diamond"]],
    o: "storm/reanimation engine",
    t: "infinite_combo",
  },
  {
    s: [["Godo, Bandit Warlord"], ["Helm of the Host"]],
    o: "infinite combat",
    t: "infinite_combo",
  },
  {
    s: [["Rest in Peace"], ["Helm of Obedience"]],
    o: "Exile target opponent's library",
    t: "infinite_combo",
  },
  {
    s: [
      ["Outrider en-Kor", "Lightning Greaves", "Shuko"],
      ["Task Force"],
      ["Worthy Cause", "Animal Boneyard", "Miren, the Moaning Well"],
    ],
    o: "infinite life",
    t: "infinite_combo",
  },
  {
    s: [["Auriok Salvagers"], ["Lion's Eye Diamond"]],
    o: "infinite mana and recurring CMC 1-or-less artifacts",
    t: "infinite_combo",
  },
  {
    s: [["Opalescence"], ["Parallax Wave"]],
    o: "repeatable/permanent creature exile and infinite ETB reuse",
    t: "infinite_combo",
  },
  { s: [["Stuffy Doll"], ["Guilty Conscience"]], o: "kill a player", t: "combo" },
  {
    s: [["Faith's Reward", "Second Sunrise"], ["Codex Shredder"], ["Zuran Orb"]],
    o: "infinite mana",
    t: "infinite_combo",
  },
  {
    s: [["Oblivion Ring"], ["Leonin Relic-Warder"], ["Fiend Hunter"]],
    o: "infinite ETB triggers",
    t: "infinite_combo",
  },
  {
    s: [
      ["Mnemonic Wall", "Archaeomancer"],
      [
        "Crystal Shard",
        "Erratic Portal",
        "Conjurer's Closet",
        "Cache Raiders",
        "Followed Footsteps",
      ],
      ["Time Warp", "Time Stretch", "Walk the Aeons"],
    ],
    o: "infinite turns",
    t: "infinite_combo",
  },
  {
    s: [["Palinchron"], ["Nim Deathmantle"], ["High Market", "Diamond Valley"]],
    o: "infinite mana, life and gravestorm",
    t: "infinite_combo",
  },
  {
    s: [["Filigree Sages"], ["Magistrate's Scepter"], ["Contagion Engine"]],
    o: "infinite turns",
    t: "infinite_combo",
  },
  {
    s: [
      ["Umbral Mantle", "Lightning Greaves", "Shuko"],
      ["Cephalid Aristocrat", "Cephalid Illusionist"],
    ],
    o: "infinite self-mill",
    t: "infinite_combo",
  },
  {
    s: [["Isochron Scepter"], ["Mystical Tutor"], ["Beacon of Tomorrows"]],
    o: "infinite turns",
    t: "infinite_combo",
  },
  {
    s: [["Patron of the Moon"], ["Amulet of Vigor"], ["Storm Cauldron"]],
    o: "infinite mana/landfall",
    t: "infinite_combo",
  },
  {
    s: [["Patron of the Moon"], ["Amulet of Vigor"], ["Ghost Town"]],
    o: "infinite landfall during opponents' turns",
    t: "infinite_combo",
  },
  {
    s: [["Patron of the Moon"], ["Amulet of Vigor"], ["Uyo, Silent Prophet"], ["Turnabout"]],
    o: "infinite mana/landfall",
    t: "infinite_combo",
  },
  {
    s: [["Palladium Myr"], ["Aura of Dominion"], ["Pili-Pala"], ["Heartstone"]],
    o: "infinite colored mana",
    t: "infinite_combo",
  },
  {
    s: [["Power Artifact"], ["Basalt Monolith", "Grim Monolith"]],
    o: "infinite colorless mana",
    t: "infinite_combo",
  },
  { s: [["Planar Portal"], ["Beacon of Tomorrows"]], o: "infinite turns", t: "infinite_combo" },
  {
    s: [["Deadeye Navigator"], ["Palinchron", "Great Whale", "Peregrine Drake"]],
    o: "infinite mana",
    t: "infinite_combo",
  },
  {
    s: [["Aphetto Alchemist"], ["Illusionist's Bracers"]],
    o: "infinite untaps",
    t: "infinite_combo",
  },
  {
    s: [["Master Transmuter"], ["Ugin's Nexus"], ["Mirrorworks"]],
    o: "infinite turns",
    t: "infinite_combo",
  },
  {
    s: [["Brine Elemental"], ["Vesuvan Shapeshifter"]],
    o: "infinite skips of target opponent's untap step",
    t: "infinite_combo",
  },
  {
    s: [["Myr Battlesphere"], ["Master Transmuter"], ["Gilded Lotus"], ["Clock of Omens"]],
    o: "infinite mana",
    t: "infinite_combo",
  },
  {
    s: [["Relic of Progenitus"], ["Hive Mind"], ["Paradigm Shift"]],
    o: "mill all libraries",
    t: "infinite_combo",
  },
  {
    s: [["Leyline of the Void"], ["Helm of Obedience"]],
    o: "exile target library",
    t: "infinite_combo",
  },
  { s: [["Avatar of Woe"], ["Thornbite Staff"]], o: "destroy all creatures", t: "infinite_combo" },
  {
    s: [["Necrotic Ooze"], ["Pili-Pala"], ["Palladium Myr"]],
    o: "infinite mana of any color",
    t: "infinite_combo",
  },
  {
    s: [["Mikaeus, the Unhallowed"], ["Cinderhaze Wretch"], ["Lightning Greaves"]],
    o: "infinite discard",
    t: "infinite_combo",
  },
  {
    s: [["Bloodchief Ascension"], ["Mindcrank"]],
    o: "infinite mill/life loss/life gain",
    t: "infinite_combo",
  },
  {
    s: [["Triskelion"], ["Mephidross Vampire"]],
    o: "infinite damage to target creatures",
    t: "infinite_combo",
  },
  { s: [["Sanguine Bond"], ["Blood Tribute"]], o: "kill an opponent", t: "infinite_combo" },
  {
    s: [["Wound Reflection"], ["Blood Tribute"]],
    o: "target opponent loses all life",
    t: "infinite_combo",
  },
  {
    s: [["Carnival of Souls"], ["Gravecrawler"], ["Carrion Feeder"], ["Blood Artist"]],
    o: "infinite gravestorm and infinitely large creature",
    t: "infinite_combo",
  },
  {
    s: [["Thief of Blood"], ["Vampire Hexmage"], ["Mikaeus, the Unhallowed"]],
    o: "infinite gravestorm and ETB triggers",
    t: "infinite_combo",
  },
  {
    s: [["Salvaging Station"], ["Krark-Clan Ironworks"], ["Flayer Husk"]],
    o: "infinite colorless mana",
    t: "infinite_combo",
  },
  {
    s: [["Blade of the Bloodchief"], ["Gorgon Flail"], ["Triskelion"]],
    o: "infinite creature destruction",
    t: "infinite_combo",
  },
  {
    s: [["Karn, Silver Golem"], ["Salvaging Station"], ["Mana Crypt"]],
    o: "infinite colorless mana",
    t: "infinite_combo",
  },
  {
    s: [["Dross Scorpion"], ["Pentavus"], ["Gilded Lotus", "Basalt Monolith"]],
    o: "infinite mana",
    t: "infinite_combo",
  },
  {
    s: [["Clock of Omens"], ["Myr Turbine"], ["Blasting Station", "Grinding Station"]],
    o: "infinite creatures",
    t: "infinite_combo",
  },
  {
    s: [["Dovescape"], ["Guile"]],
    o: "infinite 1/1 Birds and counter noncreature spells",
    t: "infinite_combo",
  },
  {
    s: [["Rasputin Dreamweaver"], ["Deadeye Navigator"], ["Gemstone Array"]],
    o: "infinite mana",
    t: "infinite_combo",
  },
  {
    s: [["Deadeye Navigator"], ["Felidar Guardian"], ["Gilded Lotus"]],
    o: "infinite mana",
    t: "infinite_combo",
  },
  {
    s: [
      ["Outrider en-Kor", "Lightning Greaves", "Shuko"],
      ["Task Force"],
      ["Disciple of Griselbrand"],
    ],
    o: "infinite life",
    t: "infinite_combo",
  },
  { s: [["Duskmantle Guildmage"], ["Mindcrank"]], o: "infinite mill", t: "infinite_combo" },
  {
    s: [["Mikaeus, the Unhallowed"], ["Sage of Fables"], ["Ashnod's Altar"]],
    o: "infinite draw, gravestorm and ETB",
    t: "infinite_combo",
  },
  {
    s: [
      ["Kiki-Jiki, Mirror Breaker", "Splinter Twin"],
      ["Pestermite", "Deceiver Exarch"],
    ],
    o: "infinite tokens",
    t: "infinite_combo",
  },
  { s: [["Charmbreaker Devils"], ["Time Warp"]], o: "infinite turns", t: "infinite_combo" },
  { s: [["Turnabout"], ["Reiterate"]], o: "infinite mana", t: "infinite_combo" },
  {
    s: [
      ["Niv-Mizzet, the Firemind"],
      ["Ophidian Eye", "Curiosity", "Tandem Lookout"],
      ["Mind Over Matter"],
    ],
    o: "infinite draw and damage",
    t: "infinite_combo",
  },
  { s: [["Krenko, Mob Boss"], ["Intruder Alarm"]], o: "infinite Goblins", t: "infinite_combo" },
  {
    s: [["Eternal Witness"], ["Crystal Shard", "Erratic Portal"], ["Time Warp", "Time Stretch"]],
    o: "infinite turns",
    t: "infinite_combo",
  },
  { s: [["Palinchron"], ["Vorinclex, Voice of Hunger"]], o: "infinite mana", t: "infinite_combo" },
  {
    s: [["Earthcraft", "Opposition"], ["Squirrel Nest"]],
    o: "infinite Squirrels",
    t: "infinite_combo",
  },
  {
    s: [["Quillspike"], ["Devoted Druid"]],
    o: "infinitely large creature; with Rite of Consumption, infinite damage/life",
    t: "infinite_combo",
  },
  {
    s: [["Necrogenesis"], ["Ashnod's Altar"]],
    o: "repeatable graveyard exile and token production",
    t: "infinite_combo",
  },
  { s: [["Conspiracy"], ["Turntimber Ranger"]], o: "infinite tokens", t: "infinite_combo" },
  {
    s: [["Earthcraft"], ["Squirrel Nest"], ["Goblin Bombardment"]],
    o: "infinite damage",
    t: "infinite_combo",
  },
  {
    s: [["Kiki-Jiki, Mirror Breaker"], ["Seeker of Skybreak"]],
    o: "infinite tapped creatures",
    t: "infinite_combo",
  },
  { s: [["Sprout Swarm"], ["Mana Echoes"]], o: "infinite Saprolings", t: "infinite_combo" },
  { s: [["Sekki, Seasons' Guide"], ["Warstorm Surge"]], o: "infinite damage", t: "infinite_combo" },
  {
    s: [["Kiki-Jiki, Mirror Breaker"], ["Wirewood Channeler"], ["Umbral Mantle"]],
    o: "infinite mana and creatures",
    t: "infinite_combo",
  },
  {
    s: [["Sharuum the Hegemon"], ["Phyrexian Metamorph", "Sculpting Steel"]],
    o: "infinite ETB and gravestorm",
    t: "infinite_combo",
  },
  {
    s: [["Niv-Mizzet, the Firemind"], ["Keen Sense"]],
    o: "infinite draw and damage",
    t: "infinite_combo",
  },
  { s: [["Palinchron"], ["Riku of Two Reflections"]], o: "infinite mana", t: "infinite_combo" },
  {
    s: [["Kiki-Jiki, Mirror Breaker"], ["Time Warp"], ["Eternal Witness"]],
    o: "infinite turns",
    t: "infinite_combo",
  },
  {
    s: [["Zhur-Taa Druid"], ["Orochi Leafcaller"], ["Freed from the Real", "Pemmin's Aura"]],
    o: "infinite mana",
    t: "infinite_combo",
  },
  {
    s: [["Ral Zarek"], ["Nissa, Worldwaker"], ["The Chain Veil"]],
    o: "infinite planeswalker activations",
    t: "infinite_combo",
  },
  {
    s: [["Mikaeus, the Unhallowed"], ["Ulasht, the Hate Seed"], ["Ashnod's Altar"]],
    o: "infinite colorless mana, Saprolings and damage",
    t: "infinite_combo",
  },
  {
    s: [["Golgari Germination"], ["Phyrexian Altar"], ["Nether Traitor"], ["Goblin Bombardment"]],
    o: "infinite damage",
    t: "infinite_combo",
  },
  // Added from Commander Spellbook (sorted by popularity), Aug 2026 —
  // only combos with a complete, verified card list were added; entries
  // showing "+N other card(s)/prerequisite(s)" on the source page were
  // skipped since the full piece list wasn't visible without fetching each
  // individual combo page, and an incomplete card list risks false-positive
  // detection (flagging a combo as present when a required piece is missing).
  {
    s: [["Basalt Monolith"], ["Forsaken Monument"]],
    o: "infinite colorless mana",
    t: "infinite_combo",
  },
  {
    s: [["Pitiless Plunderer"], ["Ashnod's Altar"], ["Reassembling Skeleton"]],
    o: "infinite colorless mana and death triggers",
    t: "infinite_combo",
  },
  {
    s: [["Sensei's Divining Top"], ["Foundry Inspector"], ["Mystic Forge"]],
    o: "infinite card draw",
    t: "infinite_combo",
  },
  {
    s: [["Bruvac the Grandiloquent"], ["Maddening Cacophony"]],
    o: "infinite mill",
    t: "infinite_combo",
  },
  {
    s: [["Restoration Angel"], ["Felidar Guardian"]],
    o: "infinite creature ETB/LTB (blink loop)",
    t: "infinite_combo",
  },
  {
    s: [["Kinnan, Bonder Prodigy"], ["Basalt Monolith"]],
    o: "infinite colorless mana",
    t: "infinite_combo",
  },
  {
    s: [["Teferi, Time Raveler"], ["Displacer Kitten"], ["Sol Ring"]],
    o: "infinite card draw",
    t: "infinite_combo",
  },
  {
    s: [["Blasphemous Act"], ["Repercussion"]],
    o: "near-infinite damage to all players",
    t: "infinite_combo",
  },
  // Second pass, Aug 2026 -- worked through the previously-skipped "+N other"
  // entries by fetching each individual combo page for its full card list.
  // Learned two important patterns doing this: some "+1 other" turned out to
  // be a GENERIC requirement (e.g. "any permanent castable for {C}", "an
  // additional Zombie/Squirrel you control") rather than a specific card --
  // those were skipped entirely, since they can't be encoded as a fixed card
  // name and a curated guess risks false positives. Others turned out to be
  // a described CONDITION already implied by the two named cards (e.g. "you
  // have a way to gain life", "no two cards in library share a name",
  // "you have at least 51 life") -- those were safe to add as the plain
  // card pair. Also found 4 of the fetched candidates were already covered
  // by the original base list under slightly different outcome wording, so
  // only the genuinely new ones below got added.
  { s: [["Aetherflux Reservoir"], ["Exquisite Blood"]], o: "infinite damage", t: "infinite_combo" },
  { s: [["The Gitrog Monster"], ["Dakmor Salvage"]], o: "infinite self-mill", t: "infinite_combo" },
  {
    s: [["Sheoldred, the Apocalypse"], ["Peer into the Abyss"]],
    o: "opponent loses the game (situational: needs a high library-to-life ratio on their side)",
    t: "infinite_combo",
  },
  // Verified against a community primer for The Wise Mothman (Aug 2026) --
  // traced the actual oracle text of every piece before adding. A genuine,
  // deterministic, mana-free loop: sacrifice Glen Elendra to the Altar
  // (mills equal to her power), her Persist trigger returns her with a
  // -1/-1 counter, the Great Henge's "nontoken creature enters" trigger
  // adds a +1/+1 counter (cancelling the -1/-1) and draws a card, ready to
  // repeat. No randomness involved, unlike several other combos the same
  // primer described that depend on milling a nonland card each iteration
  // (probabilistic, deliberately NOT added here as "infinite").
  {
    s: [["Glen Elendra Archmage"], ["The Great Henge"], ["Altar of Dementia"]],
    o: "infinite card draw and mill (and infinite counterspell activations, alternating which sacrifice you choose each cycle)",
    t: "infinite_combo",
  },
  {
    s: [
      ["Karmic Guide"],
      ["Reveillark"],
      ["Viscera Seer", "Ashnod's Altar", "Phyrexian Altar", "Altar of Dementia", "Carrion Feeder"],
    ],
    o: "infinite ETB/LTB reanimation loop (Karmic Guide is power 2, qualifying for Reveillark's return; Karmic Guide's own return has no restriction, so it brings Reveillark back unrestricted)",
    t: "infinite_combo",
  },
  {
    s: [
      ["Metallic Mimic"],
      ["Murderous Redcap"],
      ["Viscera Seer", "Ashnod's Altar", "Phyrexian Altar", "Altar of Dementia", "Carrion Feeder"],
    ],
    o: "infinite damage (Murderous Redcap is a Goblin Assassin; Metallic Mimic naming either type grants a +1/+1 counter on re-entry that cancels Persist's -1/-1 counter, so it always dies eligible for Persist again, re-triggering its ETB damage every loop)",
    t: "infinite_combo",
  },
  {
    s: [
      ["Kiki-Jiki, Mirror Breaker"],
      ["Faceless Butcher"],
      ["Viscera Seer", "Ashnod's Altar", "Phyrexian Altar", "Altar of Dementia", "Carrion Feeder"],
    ],
    o: "infinite ETB/LTB exile loop (Kiki-Jiki copies Faceless Butcher; the token's ETB exiles Kiki-Jiki; sacrificing the token returns Kiki-Jiki, already hasty, to tap again)",
    t: "infinite_combo",
  },
  {
    s: [
      ["Staff of Domination"],
      [
        "Elvish Archdruid",
        "Priest of Titania",
        "Wirewood Channeler",
        "Circle of Dreams Druid",
        "Marwyn, the Nurturer",
      ],
    ],
    o: "infinite mana once the dork taps for 5+ (5+ Elves/creatures in play, or Marwyn at 5+ power) -- untapping the dork costs {3} via Staff plus {1} to untap Staff itself, so the loop nets a profit above that threshold",
    t: "infinite_combo",
  },
];

export const SOFT_SYNERGIES: readonly CuratedCombo[] = [
  {
    s: [["Mycosynth Lattice"], ["Darksteel Forge"]],
    o: "near-total board resilience -- everything becomes an indestructible artifact",
    t: "lock",
  },
  {
    s: [["Mycosynth Lattice"], ["Stony Silence"]],
    o: "lockdown of activated abilities, including mana abilities",
    t: "lock",
  },
  {
    s: [["Well of Lost Dreams"], ["Words of Worship"]],
    o: "repeatable card draw through life gain",
    t: "synergy",
  },
  {
    s: [["Daru Spiritualist"], ["Shaman en-Kor"]],
    o: "two infinitely large blockers",
    t: "synergy",
  },
  {
    s: [["Teferi, Mage of Zhalfir"], ["Knowledge Pool"]],
    o: "opponents can't cast spells from hand",
    t: "lock",
  },
  {
    s: [["Mycosynth Lattice"], ["Darksteel Forge"], ["Nevinyrral's Disk"]],
    o: "destroy everything except your permanents",
    t: "lock",
  },
  {
    s: [["Enchanted Evening"], ["Opalescence"]],
    o: "lands are removed and won't stick",
    t: "lock",
  },
  {
    s: [["Containment Priest"], ["Mistmeadow Witch"]],
    o: "repeatable exile of target creature",
    t: "synergy",
  },
  { s: [["Flash"], ["Academy Rector"]], o: "fetch any enchantment at instant speed", t: "synergy" },
  {
    s: [["Dovescape"], ["Night of Souls' Betrayal"], ["Humility"]],
    o: "all noncreature spells are countered",
    t: "synergy",
  },
  {
    s: [["Sen Triplets"], ["Mycosynth Lattice", "Celestial Dawn"]],
    o: "play spells from target opponent's hand",
    t: "synergy",
  },
  { s: [["Wild Research"], ["Spell Crumple"]], o: "recurring counter", t: "synergy" },
  { s: [["Swans of Bryn Argoll"], ["Seismic Assault"]], o: "recurring card draw", t: "synergy" },
  {
    s: [["Mistveil Plains"], ["Sunforger"], ["Render Silent"]],
    o: "recurring Silence",
    t: "synergy",
  },
  {
    s: [["Rafiq of the Many"], ["Finest Hour", "Might of Oaks"]],
    o: "potential 22 general damage",
    t: "synergy",
  },
  {
    s: [["Enchanted Evening"], ["Fracturing Gust"]],
    o: "destroy all permanents and gain life",
    t: "synergy",
  },
  {
    s: [["Vindicate"], ["Radiate"], ["Spiritual Asylum"]],
    o: "destroy each target permanent except protected categories",
    t: "synergy",
  },
  {
    s: [["Searing Meditation"], ["Tamanoa"]],
    o: "repeatable damage/life gain limited by mana",
    t: "synergy",
  },
  {
    s: [["Clutch of the Undercity"], ["Radiate"]],
    o: "bounce each target permanent and cause life loss",
    t: "synergy",
  },
  {
    s: [["Deadeye Navigator"], ["Sedris, the Traitor King"]],
    o: "recurring creature resurrection",
    t: "synergy",
  },
  {
    s: [
      ["Necrogenesis"],
      ["Grave Pact", "Dictate of Erebos", "Ruthless Deathfang"],
      ["Ashnod's Altar"],
    ],
    o: "force opponents to sacrifice creatures",
    t: "synergy",
  },
  {
    s: [["Vigor"], ["Blasphemous Act"], ["Clone"]],
    o: "your creatures get 26 +1/+1 counters",
    t: "synergy",
  },
  { s: [["Horde of Notions"], ["Crib Swap"]], o: "recurring removal", t: "synergy" },
  {
    s: [["Reaper King"], ["Conspiracy", "Arcane Adaptation", "Xenograft"]],
    o: "every creature ETB destroys a permanent",
    t: "synergy",
  },
  { s: [["Greater Good"], ["Lifeline"]], o: "recurring draw and creatures", t: "synergy" },
  {
    s: [["Sylvan Library"], ["Abundance"]],
    o: "choose three land/nonland cards each turn",
    t: "synergy",
  },
  {
    s: [["Well of Lost Dreams"], ["Pristine Talisman"]],
    o: "recurring draw and life gain",
    t: "synergy",
  },
  { s: [["Mycosynth Lattice"], ["Kill Switch"]], o: "tap all permanents", t: "synergy" },
  {
    s: [["Inquisitor's Flail", "Fireshrieker"], ["Grafted Exoskeleton"]],
    o: "double poison/-1/-1 counters",
    t: "synergy",
  },
  { s: [["Inquisitor's Flail"], ["Fireshrieker"]], o: "quadruple damage", t: "synergy" },
  {
    s: [["Buried Ruin"], ["Mindslaver"], ["Crucible of Worlds"]],
    o: "recurring Mindslaver activations",
    t: "synergy",
  },
  { s: [["Myr Matrix"], ["Blinkmoth Urn"]], o: "snowballing precombat mana", t: "synergy" },
];
