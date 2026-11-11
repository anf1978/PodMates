// ---- Regex patterns for per-card tagging ----
export const PATTERNS = {
  ramp: /(search your library for a.*land|search your library for.*basic land card|search your library for an? (forest|island|swamp|mountain|plains)( or (forest|island|swamp|mountain|plains))*( card)?,? put (that card|it) onto the battlefield|additional land|adds? (\{[wubrgc]\}|[a-z]+ mana)|add (\{[wubrgc]\}){2,}|add one mana of any color|add two mana|add three mana)/i,
  // Guards against the named-basic-land ramp clause above matching cards that
  // aren't actually unconditional ramp: catch-up effects gated on the
  // opponent having more lands, punisher effects triggered by the opponent's
  // extra land drops, and old-style "Sacrifice this land: search for a land"
  // cycling lands (net zero land advantage, same as modern fetch lands).
  rampCatchUpGate:
    /(controls more lands than you|who controls more lands than you|opponent's control without being played|sacrifice this land:\s*search)/i,
  // "Who benefits?" exclusion: some removal/counterspell effects give the
  // OPPONENT a Treasure as a design-balance drawback (An Offer You Can't
  // Refuse: "Its controller creates two Treasure tokens" — "its controller"
  // is the countered spell's owner, not the caster). Ramp requires the
  // caster to actually gain the mana; this is a genuine exclusion, not a
  // narrower version of ramp.
  opponentBenefitGate:
    /(its controller creates?|that player creates?|target opponent creates?|each opponent creates?) .{0,20}treasure/i,
  // Mana-fixing enchantments that REPLACE a land's ability outright (no net
  // mana gain, just recoloring) are fixing, not ramp — distinct from Wild
  // Growth-style auras that grant "an additional" mana on top of the
  // land's normal output (see manaEnchantmentRamp below).
  fixingReplacementGate: /enchanted (land|permanent) has ".{0,60}add/i,
  manaEnchantmentRamp: /adds? an additional (\{[wubrgc]\}|one mana|\w+ mana)/i,
  manaMultiplier:
    /(double the amount of .{0,35}mana|produces (twice|three times|\d+ times) as much|add(s)? an additional (one )?(mana|\{[wubrgc]\})|add(s)? one mana of any type that land produced)/i,
  costReducerRamp:
    /(artifact|creature|instant and sorcery|instant|sorcery) spells (you cast |of the (chosen|exiled) type )?cost \{\d+\} less to cast|spells you cast that share a card type with the exiled card cost \{\d+\} less to cast/i,
  untapperGeneric:
    /untap (target|another target|all|that) (nonland )?(artifact|land|permanent|creature)/i,
  landEngineScaling:
    /add \{[wubrgc]\} for each|add an amount of mana.{0,30}equal to your devotion/i,
  sacrificeMana: /sacrifice (a|an|another) .{0,25}: add \{/i,
  // Trigger-payoff detection: these cards don't produce mana themselves,
  // but they turn the ACT of casting a spell or a creature entering/dying
  // into extra value. Relevant to ramp because rituals and mana dorks are
  // exactly the kind of cheap, repeatable events these payoffs reward —
  // a deck with both gets more out of its ramp than the mana alone would
  // suggest.
  castTriggerPayoff:
    /whenever you cast (a |an )?(instant|sorcery|noncreature|first)?( or (an? )?(instant|sorcery))? ?spell/i,
  creatureEventPayoff:
    /whenever (this creature or |a |another )?(another )?creature (you control )?(enters|dies)/i,
  draw: /(draws? a card\b|draws? two cards|draws? three cards|draws? (that many|x) cards|draws? a card for each|whenever.*draws? a card|draws? cards equal|puts? (that|one|it) .{0,15}into (your|their) hand)/i,
  removal:
    /(destroy target|exile target|deals? \d+ damage to target|-\d+\/-\d+ until end of turn|fight|deals? damage to any target|damage to target creature|damage to target player or planeswalker|put target creature.*into its owner's library|shuffles? .{0,15}into (its|their|your) (owner's )?library)/i,
  wipe: /(destroy all creatures|each creature gets -|all creatures get -|destroy all|each player sacrifices (a|all) creatures?|damage to each creature|exile all creatures)/i,
  protection:
    /(hexproof|indestructible|protection from|prevent all( combat)? damage|shroud|can't be the target|gains? protection)/i,
  counterMagic:
    /(counter target [\w\s,]{0,40}?spell|counter that spell|counter target activated or triggered ability|counter that (ability|triggered ability))/i,
  // "can't attack/block" excludes a "this turn" qualifier immediately
  // after -- that's a one-shot combat trick (often a modal removal spell's
  // alternate mode), not a persistent restriction. Real stax uses this
  // phrasing as a static, ongoing ability with no time-boxing.
  // "can't" branches carry a per-occurrence negative lookahead excluding
  // protective/symmetric outcomes ("players can't lose the game", "can't
  // lose life", "can't be countered", etc. -- Everybody Lives!, Platinum
  // Angel, Abyssal Persecutor, Angel's Grace, and similar "protection
  // package" cards). The lookahead sits right after "can't" so it only
  // suppresses that specific clause, not the whole card -- cards with a
  // genuine restriction elsewhere in the same text (Tomik's graveyard-land
  // lock, Dromoka's "opponents can't cast spells during your turn") still
  // match on their real clause. Tested against reminder-text-stripped input
  // at the call site (see stripReminderText) since Split Second's keyword
  // reminder ("players can't cast spells or activate abilities that aren't
  // mana abilities") and detain's reminder text otherwise falsely tag
  // ordinary removal/tempo spells (Trickbind, Krosan Grip, Lyev Decree, etc.)
  // as stax.
  stax: /(spells? cost \{\d+\} more|abilities cost \{\d+\} more|creatures (your opponents control |opponents control )?can't attack(?! this turn)|creatures (your opponents control |opponents control )?can't block(?! this turn)|can't untap|skip your (untap|draw|upkeep) step|players can't (?!\s*(lose life|lose the game|win the game|die|be sacrificed|be destroyed|be dealt damage|be countered|be the target|be chosen))|opponents can't (?!\s*(lose life|lose the game|win the game|die|be sacrificed|be destroyed|be dealt damage|be countered|be the target|be chosen))|each opponent[\w\s,']{0,40}can't (?!\s*(lose life|lose the game|win the game|die|be sacrificed|be destroyed|be dealt damage|be countered|be the target|be chosen))|taps? an untapped (artifact|creature|land)[\w\s,]{0,60}for each|each player skips their|players skip their|each player can't cast more than|player can't cast (a|more than)|don't untap during (their|its) controllers?['\u2019]? untap steps?|doesn't untap during (its|their) controllers?['\u2019]? untap step|would search (a|their) library.{0,90}(instead|search the top)|no more than (one|two|three|\d+) creatures? (can|able to) (attack|block))/i,
  // Recurring, opponent-facing forced sacrifice (Braids/Smokestack-style):
  // requires an upkeep trigger tied to "each player" or "enchanted player",
  // NOT a one-shot ETB edict (Fleshbag Marauder) or a self-only upkeep
  // drawback on a single creature (Lord of the Pit-style demons).
  staxForcedSacRecurring:
    /at the beginning of (each player's|enchanted player's) upkeep,.{0,60}sacrifices? an? (artifact|creature|land|planeswalker|permanent)/i,
  // Static "creatures/artifacts your opponents control enter tapped" tempo
  // denial — permanents only; excludes one-shot instant/sorcery effects
  // like Cone of Cold's "until your next turn" die-roll result.
  staxEntersTappedOpp:
    /(creatures?|artifacts?)[\w\s,]{0,30}(your )?opponents? control enters? tapped|artifacts? and lands? enters? tapped/i,
  // "Pay {N} or I draw/get value" taxation on opponents' actions (Rhystic
  // Study family) — a distinct, very common EDH stax template.
  staxPayOrDraw:
    /whenever an opponent (casts|draws)[^.]{0,80}(unless (that player|they) pays? \{|may pay \{[^.]{0,20}\. if (that player|the player) doesn't)/i,
  // Blanket denial of activated abilities (Null Rod family).
  // "(?! this turn)" excludes one-shot, single-turn applications (e.g.
  // Trickbind's post-counter lockout) from the persistent, always-on
  // restriction this pattern is meant to catch (Cursed Totem, Null Rod,
  // Stony Silence, etc.) -- mirrors the same exclusion already used on the
  // combat-restriction branches of PATTERNS.stax below.
  staxCantActivate: /activated abilities of .{0,40}can't be activated(?! this turn)/i,
  // Bare "each/that player sacrifices a permanent" -- deliberately requires
  // a co-occurring recurring trigger ("whenever" / "at the beginning of")
  // via staxSacrificeBareRequiresRecurring below, since the bare phrase alone
  // also matches one-shot edict effects (Crack the Earth, Forbidden Ritual)
  // and single-fire ETB triggers (Earth-Cult Elemental) that aren't ongoing
  // restrictions -- those read as one-time removal, not stax. Genuinely
  // recurring cases (Smokestack, World Queller, Spelltithe Enforcer) are
  // already phrased with "whenever" or "at the beginning of" in practice.
  staxSacrificeBare: /each player sacrifices a permanent|that player sacrifices a permanent/i,
  staxSacrificeBareRequiresRecurring: /whenever|at the beginning of/i,
  // Recurring symmetric tempo tax that bounces a land whenever a player
  // casts a spell / plays a creature / taps for mana (Mana Breach/Overburden
  // /War's Toll family) — distinct from a one-shot bounce spell.
  staxRecurringBounceTax:
    /whenever a player (casts a spell|puts a nontoken creature onto the battlefield|taps a land for mana),.{0,40}(returns a land|tap all lands)/i,
  // Land-type/color-stripping mana denial (Blood Moon family) — deliberately
  // narrow and template-specific rather than a broad "lands" regex, to avoid
  // false-positiving on the thousands of ordinary land-related cards.
  staxLandHate:
    /nonbasic lands? (you control |your opponents control )?(are|become) (a |)(forest|island|swamp|mountain|plains)|lands? (lose all abilities|produces? colorless mana instead of any other (type|color))|produces \{[wubrgc]\} instead of any other (type|color|amount)/i,
  // Guards the color-stripping addition above against self-fixing effects
  // that turn the CONTROLLER's own lands into a useful color (a benefit,
  // not land-hate against opponents) — e.g. "if you tap a land you control
  // for mana, it produces {U} instead."
  staxLandHateSelfGuard: /if you tap a land you control for mana, it produces/i,
  // "Spells [qualifier] cost {N} more" — broadened to allow a qualifier
  // clause between the subject and "cost" (Grand Arbiter Augustin IV: "Spells
  // your opponents cast cost {1} more to cast"). Guarded below against
  // self-referential drawback text ("spells you cast cost more", "spells
  // that target it cost more") which tax the caster, not opponents.
  staxSpellsQualifiedTax: /spells?[\w\s,']{0,30}cost \{\d+\}( or more)? more( to cast)?/i,
  staxSpellsQualifiedTaxSelfGuard:
    /spells (you cast|they cast this turn)[\w\s,']{0,15}cost \{\d+\}( or more)? more|spells that target it cost \{\d+\}( or more)? more/i,
  // Ability granted to a whole card class making it self-destruct unless a
  // per-turn tax is paid (Tabernacle/Kataki family).
  staxGrantedUpkeepTax:
    /(all|other) (artifacts|creatures|enchantments|permanents) have "at the beginning of (your|each player's) upkeep,.{0,50}unless (you|its controller) pays? \{/i,
  // Storm Cauldron-style passive land bounce keyed off any land being
  // tapped for mana (not who controls it).
  staxLandTappedReturn: /whenever a land is tapped for mana, (return it|its controller)/i,
  // Recurring symmetric land-attrition tied to creature deaths (Burning
  // Sands/Earthlink family) — distinct enough phrasing to regex directly.
  staxCreatureDeathLandSac:
    /whenever a creature dies, that creature's controller sacrifices a land/i,
  // "discard" is meant to capture hand disruption AGAINST OPPONENTS (Mind
  // Twist, Thoughtseize-adjacent effects), not the controller's own card
  // selection. The bare "hand size" branch below is replaced with a
  // hostile-specific variant: "you have no maximum hand size" (a self-buff,
  // the OPPOSITE of discard pressure) was previously the overwhelming
  // majority of hand-size matches, while genuinely hostile hand-size
  // disruption (Jin-Gitaxias: "each opponent's maximum hand size is reduced
  // by seven") is comparatively rare and needs its own specific phrasing.
  // Paired with discardSelfGuard below, which excludes the extremely common
  // self-directed "draw a card, then discard a card" looter template,
  // connive/recruit reminder text, self-paid activation costs (colon or
  // "additional cost to cast this spell" syntax), and delayed self-drawback
  // discards ("at the beginning of your upkeep, discard a card").
  discard:
    /(discards? (a|that|the) card|discards? \w+ cards|discards? (their|a) hand|each opponent discards|target player discards|opponents?('s)? maximum hand size (is |are )?(reduced|lowered))/i,
  discardSelfGuard:
    /discards? [^.:]{0,50}:|draws? ([\w]+ )?cards?,? (then |and )?discards? ([\w]+ )?cards?|discards? ([\w]+ )?cards?,? (then |and )?draws? ([\w]+ )?cards?|you (may )?discards?\b|additional cost to cast this spell.{0,60}discard|at the beginning of your (next )?(upkeep|end step|draw step).{0,80}discard|discard a card to draw a card/i,
  mld: /(destroy all .{0,30}lands|each player sacrifices a land|target land.*sacrifice|players? sacrifices? .*lands|exile all lands|nonbasic lands? .*destroy)/i,
  extraTurn: /(takes? an? extra turn|additional turn after this one|extra turn after this)/i,
  // Excludes basic-land-type words (not just the literal word "land") so
  // classic fetchlands ("search for a Forest or Plains card") don't count
  // as tutors -- but unlike a blanket land-type exclusion at the call site,
  // this still correctly catches genuine non-land-searching tutor effects
  // printed on a land (Maelstrom of the Spirit Dragon searching for a
  // Dragon card, Urza's Saga/Inventors' Fair for an artifact, Sanctum/Eye
  // of Ugin for a creature, etc.) -- audited against every land in the
  // database matching this pattern to confirm the split is exact.
  // Second alternative explicitly carves out "search for a creature or land
  // card" (Archdruid's Charm, Traverse the Ulvenwald, Analyze the Pollen --
  // the only 3 cards using this exact template): these are genuine creature
  // tutors with land search as a secondary mode, not fetchland-style pure
  // land search, so they shouldn't be caught by the land-exclusion above.
  tutor:
    /search your library for (a|an|up to \w+) (?!.*\b(land|forest|plains|mountain|swamp|island|gate)\b)[\w\s]{0,40}?card|search your library for a creature or land card/i,
  sac: /(each (player|opponent) sacrifices|target (player|opponent) sacrifices|edict)/i,
  altWin: /(you win the game|\bwins the game\b)/i,
  // Sudden Game Over Effects: combat damage (or, narrowly, non-combat damage)
  // to a player that causes THAT PLAYER to lose the game, rather than the
  // caster winning outright (Phage the Untouchable, Vorpal Sword). Distinct
  // phrasing family from "you win the game" — see altWinCombatDamageCurated
  // below for a few stragglers whose trigger clause crosses a sentence
  // boundary and doesn't fit a single bounded-gap regex safely.
  altWinCombatDamage:
    /deals (combat )?damage to (a player|an opponent|that player)[^.]{0,160}(that player|they) loses? the game/i,
  millSelf:
    /(mills? \w+ cards|puts? the top \w+ cards? of (your|target player's|each player's) library into.*graveyard)/i,
  millOpponent:
    /(target (player|opponent) mills|each opponent mills|mills? \w+ cards? from (their|a) library|reveals cards from the top of their library until)/i,
  burnFace:
    /(deals? \d+ damage to (that player|target player|each opponent|target opponent)|deals damage to a player equal to|deals? \d+ damage to any target|damage divided .{0,25}among any number of targets)/i,
  infect: /(infect|poison counter)/i,
  reanimate:
    /(creature card.{0,20}graveyard.{0,60}(onto the battlefield|to the battlefield)|permanent card.{0,60}graveyard.{0,60}(onto the battlefield|to the battlefield)|return(s)? (target |enchanted )?creature.{0,10}from.{0,20}graveyard.{0,20}battlefield|put(s)?.{0,15}creature card.{0,20}graveyard onto the battlefield)/i,
  punisher:
    /(deals? \d+ damage to (that|each) (player|opponent)|deals \d+ damage to that (land's controller|player)|whenever (a player|an opponent) (taps|draws|casts).{0,60}deals? \d+ damage|deals? \d+ damage to any target|unless (that player|they) (pay|discard|sacrifice)|each player'?s upkeep.{0,40}sacrifices|deals damage equal to (its|this creature's|that permanent's|this permanent's) power to (that|each) (player|opponent))/i,
  // Theme / synergy axes
  aristocrats:
    /(whenever .{0,70}dies|whenever a creature you control dies|whenever another creature dies|sacrifice a creature:|sacrifice another creature)/i,
  sacOutlet:
    /(sacrifice a creature:|sacrifice another creature:|sacrifice an artifact:|\{t\}, sacrifice)/i,
  tokens: /creates? .{0,40}tokens?\b/i,
  artifactsMatter:
    /(artifact you control|artifacts you control|artifact creatures? you control|whenever an artifact enters|affinity for artifacts|artifact spells? you cast)/i,
  spellslinger:
    /(whenever you cast (an instant|a sorcery|a noncreature)|copy target (instant|sorcery)|storm\b|magecraft)/i,
  graveyard:
    /(from (your |a )?graveyard|cards? in (your |a )?graveyard|exile .{0,20}from .{0,15}graveyard|return .{0,25}from .{0,15}graveyard)/i,
  lifegain: /(you gain \d+ life|you gain life|gain life equal|lifelink)/i,
  drain:
    /(each opponent loses? \d+ life|target opponent loses? \d+ life|target player loses? \d+ life|loses life equal|opponent loses life|loses that much life)/i,
  landfall:
    /(landfall|whenever a land enters the battlefield under your control|whenever (this land or another|one or more) lands? you control enters?)/i,
  // Generic "counters matter" signal — deliberately excludes loyalty and
  // lore counters, since those are universal rules-support boilerplate on
  // every planeswalker (303 in DB) and every Saga (213 in DB) respectively,
  // not a meaningful counters-strategy signal. -1/-1 is handled by its own
  // dedicated pattern below (see minusCounters) and cross-feeds this tag.
  counters:
    /(\+1\/\+1 counter|proliferate|whenever .{0,30}counter is put|shield counter|stun counter|oil counter|fate counter|charge counter|experience counter|energy counter|depletion counter|quest counter|spore counter|wish counter|net counter|finality counter|vitality counter|corpse counter|ticket counter|blood counter|ice counter|age counter|gold counter|hoofprint counter|feather counter|level counter|one or more counters|had counters on it|put those counters|counters can't be put|can't get counters|put .{0,15}counters on (a|target|that|another)|double the number of counters|of each of those counters|any number of counters|remove a counter from|move a counter from|counter of any kind|counter of each kind)/i,
  // -1/-1 counters get their own tag — mechanically the opposite of +1/+1
  // (attrition/removal rather than growth), with dedicated payoffs like The
  // Scorpion God. Still cross-feeds the generic `counters` tag above, since
  // sign-agnostic payoffs (The Great Goblin: "whenever you put one or more
  // counters...") care about counter placement regardless of type.
  minusCounters: /-1\/-1 counter/i,
  blink: /(exile .{0,80}return .{0,40}battlefield|flicker|blink)/i,
  // Land Buffing: cards that make "many lands" itself the payoff — land
  // reanimation (often huge value alongside board wipes or a big graveyard),
  // land-count-scaling bodies, and mass land search. Distinct from plain
  // ramp (which is about mana efficiency) and from landfall (which triggers
  // per land drop) — this is the Field of the Dead family, where the raw
  // count of lands in play is the thing being built toward.
  landBuffingReanimation:
    /return (all |target |up to \w+ )?(target )?land cards?[^.]{0,60}(graveyard)[^.]{0,40}battlefield|play (land cards? )?from your graveyard/i,
  landBuffingScaling: /power (and toughness )?(is|are)( each)? equal to the number of lands/i,
  landBuffingMassSearch: /search your library for (any number of|up to \w+) land cards/i,
  // Impulse draw: "exile the top card(s)... you may play/cast" — functions
  // as card-advantage with a face-up, time-limited catch. Cross-feeds the
  // generic `draw` tag (see classifyCard) since it's real card advantage,
  // but kept as its own tag since it's a distinct strategic shape (visible
  // to opponents, expires unused) that doesn't always overlap with normal
  // draw-matters decks.
  impulseDraw:
    /exile the top .{0,20}(card|cards) of (your|their) library[\s\S]{0,120}you may (play|cast)/i,
  // Payoff cards that specifically reward playing/casting from exile
  // (Prosper's Pact Boon, Passionate Archaeologist, Faldorn) — a distinct
  // synergy signal from the impulse-draw generators themselves, since these
  // embed across different color identities and strategies.
  exileMatters:
    /whenever (you|a player|another player) (cast|casts|play|plays) (a |an )?(spell|card|land)( or (a |an )?(spell|card|land))? from exile|casting spells from exile|spells? cast from exile/i,
  engine: /(whenever |at the beginning of|\{t\}:)/i,
};
