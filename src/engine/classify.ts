import {
  CURATED_ALT_WIN_COMBAT_DAMAGE,
  CURATED_FAST_MANA,
  CURATED_FAST_MANA_EXTENDED,
  CURATED_RAMP_UNTAPPERS,
  CURATED_STAX,
  FREE_INTERACTION_NAMES,
} from "../data/curated-cards.ts";
import type { CardRecord } from "../cards/tuple.ts";
import { PATTERNS } from "./patterns.ts";
import type { CardTags, CardTraits } from "./types.ts";

export function normalizeText(oracleText: string | null | undefined): string {
  return (oracleText || "").toLowerCase();
}

// Strips parenthetical reminder text (Oracle's standard convention for
// spelling out what a keyword/mechanic does in plain English) so that
// patterns keying off common English words don't fire on rules-reminder
// boilerplate (surveil/scry/morph/kicker/disturb/partner/detain/split-second
// explanations, etc.) instead of the card's actual functional text. Used by
// the versatilityModes check and the stax checks in classifyCard -- other
// classification patterns deliberately still see reminder text, since a few
// of them depend on exact wording that sometimes only appears there.
export function stripReminderText(text: string | null | undefined): string {
  return (text || "").replace(/\([^)]*\)/g, "");
}

/** Reads every role and theme tag off one card's type line, text and curated lists. */
export function classifyCard(card: CardRecord): CardTraits {
  const text = normalizeText(card.o);
  const type = (card.t || "").toLowerCase();
  const cmc = card.m || 0;
  const isLand = type.includes("land");
  const isCreature = type.includes("creature");
  const isInstant = type.includes("instant");
  const isSorcery = type.includes("sorcery");
  const isPermanent = !isInstant && !isSorcery && !isLand;

  const tags: CardTags = {
    ramp: false,
    fastMana: false,
    fastManaExtended: false,
    draw: false,
    removal: false,
    wipe: false,
    manaDork: false,
    manaRock: false,
    extraLand: false,
    manaEnchantment: false,
    treasureRamp: false,
    ritual: false,
    manaMultiplier: false,
    untapper: false,
    costReducer: false,
    sacrificeMana: false,
    landEngine: false,
    castTriggerPayoff: false,
    creatureEventPayoff: false,
    protection: false,
    counterMagic: false,
    stax: false,
    discard: false,
    mld: false,
    extraTurn: false,
    tutor: false,
    sac: false,
    reanimate: false,
    punisher: false,
    altWin: false,
    millSelf: false,
    millOpponent: false,
    burnFace: false,
    infect: false,
    aristocrats: false,
    sacOutlet: false,
    tokens: false,
    artifactsMatter: false,
    spellslinger: false,
    graveyard: false,
    lifegain: false,
    drain: false,
    landfall: false,
    counters: false,
    blink: false,
    engine: false,
    landBuffing: false,
    minusCounters: false,
    impulseDraw: false,
    exileMatters: false,
    freeInteraction: false,
    cheapInteraction: false,
    expensiveInteraction: false,
  };

  if (!isLand) {
    const rampExcluded =
      PATTERNS.rampCatchUpGate.test(text) ||
      PATTERNS.opponentBenefitGate.test(text) ||
      (PATTERNS.fixingReplacementGate.test(text) && !PATTERNS.manaEnchantmentRamp.test(text));
    const rampIncluded =
      PATTERNS.ramp.test(text) ||
      PATTERNS.manaEnchantmentRamp.test(text) ||
      PATTERNS.manaMultiplier.test(text) ||
      PATTERNS.costReducerRamp.test(text) ||
      CURATED_RAMP_UNTAPPERS.has(card.n);
    if (rampIncluded && !rampExcluded) tags.ramp = true;
  } else {
    // Lands stay excluded from the broad ramp regex (every basic land
    // "adds mana" too) — only genuine multi-mana/scaling lands or curated
    // fast mana lands count, matching fastmana \u2286 ramp.
    if (
      (/add (\{[wubrgc]\}){2,}/i.test(text) && !PATTERNS.rampCatchUpGate.test(text)) ||
      PATTERNS.landEngineScaling.test(text) ||
      CURATED_FAST_MANA.has(card.n)
    ) {
      tags.ramp = true;
    }
  }
  // Subtags — a card can carry several. Only computed for nonland ramp
  // where the type distinction is meaningful; manaEnchantment/multiplier/
  // costReducer/untapper/sacrificeMana apply regardless of the ramp
  // verdict itself, matching the document's subtag independence.
  if (tags.ramp && !isLand) {
    if (isCreature) tags.manaDork = true;
    else if (type.includes("artifact")) tags.manaRock = true;
    if (
      (isInstant || isSorcery) &&
      /adds? (\{[wubrgc]\}|[a-z]+ mana)|add (\{[wubrgc]\}){2,}|add one mana of any color|add two mana|add three mana/i.test(
        text,
      )
    ) {
      tags.ritual = true;
    }
  }
  if (tags.ramp && isLand) tags.landEngine = true;
  if (/additional land/i.test(text)) tags.extraLand = true;
  if (
    PATTERNS.manaEnchantmentRamp.test(text) &&
    (type.includes("aura") || type.includes("enchantment"))
  )
    tags.manaEnchantment = true;
  if (PATTERNS.manaMultiplier.test(text)) tags.manaMultiplier = true;
  if (PATTERNS.costReducerRamp.test(text)) tags.costReducer = true;
  if (PATTERNS.untapperGeneric.test(text)) tags.untapper = true;
  if (PATTERNS.sacrificeMana.test(text)) tags.sacrificeMana = true;
  if (PATTERNS.castTriggerPayoff.test(text)) tags.castTriggerPayoff = true;
  if (PATTERNS.creatureEventPayoff.test(text)) tags.creatureEventPayoff = true;
  if (tags.ramp && /creates? .{0,20}treasure/i.test(text)) tags.treasureRamp = true;
  if (CURATED_FAST_MANA.has(card.n)) tags.fastMana = true;
  if (CURATED_FAST_MANA_EXTENDED.has(card.n)) tags.fastManaExtended = true;
  if (PATTERNS.draw.test(text)) tags.draw = true;
  if (PATTERNS.removal.test(text) && !isLand) tags.removal = true;
  if (PATTERNS.wipe.test(text)) tags.wipe = true;
  // Overload turns a single-target effect into a mass one ("change 'target'
  // in its text to 'each'") -- Cyclonic Rift being the definitive example.
  // The base text alone reads as ordinary single-target bounce/removal/
  // damage, so this needs its own check rather than relying on the wipe
  // pattern above to somehow recognize a keyword-conditional mass effect.
  // Excludes graveyard-sourced targets (Mizzix's Mastery-style value/
  // recursion effects match "exile target ... from your graveyard" but
  // aren't disrupting anyone else's board).
  if (
    /overload \{/i.test(text) &&
    /return target|destroy target|exile target|deals? \d+ damage to target/i.test(text) &&
    !/from (your|a|target player's) graveyard/i.test(text)
  ) {
    tags.wipe = true;
  }
  if (PATTERNS.protection.test(text)) tags.protection = true;
  if (PATTERNS.counterMagic.test(text)) {
    // Exclude self-tax mechanics like Blood Funnel ("Whenever you cast a
    // noncreature spell, counter that spell unless you sacrifice a creature")
    // — these counter the caster's OWN spell as a cost, not an opponent's,
    // so they aren't real disruption despite matching "counter that spell".
    const selfReferential = /whenever you (cast|activate)[^.]*counter that (spell|ability)/i.test(
      text,
    );
    if (!selfReferential) tags.counterMagic = true;
  }
  // Goad effects ("goad target creature... it can't block") legitimately
  // trip the generic "creatures can't block/attack" stax alternative --
  // that clause describes a forced-combat/political consequence of being
  // goaded, not genuine resource/action denial, a different design space
  // from real stax. When "goad" appears anywhere in the text, only count
  // the card as stax if a genuinely separate signal is present (taxes,
  // can't-untap, can't-cast, etc.) -- not just the can't-attack/block
  // alternatives, which goad's own consequence clause naturally trips.
  const hasGoad = /goad/i.test(text);
  // Reminder-text-stripped view, used specifically for the stax checks below
  // (see stripReminderText and PATTERNS.stax comments) -- "text" itself is
  // left untouched since most other patterns in this function intentionally
  // still see reminder text.
  const textNoReminders = stripReminderText(text);
  if (hasGoad) {
    // Mirrors PATTERNS.stax's "can't" branch guard (see its comment) minus
    // the combat-restriction branches, which goad's own consequence clause
    // naturally trips and are deliberately excluded here.
    const nonCombatStaxPattern =
      /(spells? cost \{\d+\} more|abilities cost \{\d+\} more|can't untap|skip your (untap|draw|upkeep) step|players can't (?!\s*(lose life|lose the game|win the game|die|be sacrificed|be destroyed|be dealt damage|be countered|be the target|be chosen))|opponents can't (?!\s*(lose life|lose the game|win the game|die|be sacrificed|be destroyed|be dealt damage|be countered|be the target|be chosen))|each opponent[\w\s,']{0,40}can't (?!\s*(lose life|lose the game|win the game|die|be sacrificed|be destroyed|be dealt damage|be countered|be the target|be chosen))|taps? an untapped (artifact|creature|land)[\w\s,]{0,60}for each|each player skips their|players skip their|each player can't cast more than|player can't cast (a|more than)|don't untap during (their|its) controllers?['\u2019]? untap steps?|doesn't untap during (its|their) controllers?['\u2019]? untap step|would search (a|their) library.{0,90}(instead|search the top))/i;
    if (nonCombatStaxPattern.test(textNoReminders)) tags.stax = true;
  } else if (PATTERNS.stax.test(textNoReminders)) {
    tags.stax = true;
  }
  if (PATTERNS.staxForcedSacRecurring.test(text)) tags.stax = true;
  if (
    PATTERNS.staxSacrificeBare.test(textNoReminders) &&
    PATTERNS.staxSacrificeBareRequiresRecurring.test(textNoReminders)
  )
    tags.stax = true;
  if (isPermanent && PATTERNS.staxEntersTappedOpp.test(text)) tags.stax = true;
  if (PATTERNS.staxPayOrDraw.test(text)) tags.stax = true;
  if (PATTERNS.staxCantActivate.test(text)) tags.stax = true;
  if (PATTERNS.staxRecurringBounceTax.test(text)) tags.stax = true;
  if (PATTERNS.staxLandHate.test(text) && !PATTERNS.staxLandHateSelfGuard.test(text))
    tags.stax = true;
  if (
    PATTERNS.staxSpellsQualifiedTax.test(text) &&
    !PATTERNS.staxSpellsQualifiedTaxSelfGuard.test(text)
  )
    tags.stax = true;
  if (PATTERNS.staxGrantedUpkeepTax.test(text)) tags.stax = true;
  if (PATTERNS.staxLandTappedReturn.test(text)) tags.stax = true;
  if (PATTERNS.staxCreatureDeathLandSac.test(text)) tags.stax = true;
  if (CURATED_STAX.has(card.n)) tags.stax = true;
  if (PATTERNS.discard.test(text) && !PATTERNS.discardSelfGuard.test(text)) tags.discard = true;
  if (PATTERNS.mld.test(text)) tags.mld = true;
  // Cataclysm-style "choose one of each type, sacrifice the rest" effects
  // are genuine mass land destruction but don't fit the direct "destroy
  // all lands" phrasing above -- requires "land" to actually appear in the
  // text too, so this doesn't false-positive on non-land keep-one effects.
  if (/sacrifices? the rest/i.test(text) && /\bland\b/i.test(text)) tags.mld = true;
  if (PATTERNS.extraTurn.test(text)) tags.extraTurn = true;
  // "!isLand" removed -- was a blunt attempt to exclude fetchlands that
  // ended up also wrongly excluding genuine tutor effects printed on a
  // land (see PATTERNS.tutor comment); the pattern's own refined lookahead
  // now handles fetchland exclusion correctly, so the card-type check is
  // no longer needed and was actively wrong.
  // "!tags.ramp" avoids double-counting plain ramp spells as tutors too,
  // but the "creature or land" modal branch above is exempted from it: all
  // 3 cards using that exact phrase (Archdruid's Charm, Traverse the
  // Ulvenwald, Analyze the Pollen) legitimately earn both tags -- their
  // land mode ramps (fetches to hand) while their creature mode is a real,
  // separate tutor effect, not the same ability double-triggering the check.
  const isCreatureOrLandTutor = /search your library for a creature or land card/i.test(text);
  if (PATTERNS.tutor.test(text) && (isCreatureOrLandTutor || !tags.ramp)) tags.tutor = true;
  if (PATTERNS.sac.test(text)) tags.sac = true;
  if (PATTERNS.reanimate.test(text) && !isLand) tags.reanimate = true;
  // Living Death-style mass/symmetrical reanimation ("exile creature cards
  // from graveyard... sacrifice creatures... return exiled cards to the
  // battlefield") is a real reanimation effect but doesn't fit the direct
  // "return X from graveyard to battlefield" phrasing above.
  if (
    /exiles all creature cards from their graveyard/i.test(text) &&
    /(return|put)s?.{0,60}battlefield/i.test(text)
  )
    tags.reanimate = true;
  if (PATTERNS.punisher.test(text) && !type.includes("instant") && !type.includes("sorcery"))
    tags.punisher = true;
  if (PATTERNS.altWin.test(text)) tags.altWin = true;
  if (PATTERNS.altWinCombatDamage.test(text) || CURATED_ALT_WIN_COMBAT_DAMAGE.has(card.n))
    tags.altWin = true;
  if (PATTERNS.millOpponent.test(text)) tags.millOpponent = true;
  else if (PATTERNS.millSelf.test(text)) tags.millSelf = true;
  if (PATTERNS.burnFace.test(text)) tags.burnFace = true;
  if (PATTERNS.infect.test(text)) tags.infect = true;

  // Theme tags
  if (PATTERNS.aristocrats.test(text)) tags.aristocrats = true;
  if (PATTERNS.sacOutlet.test(text)) tags.sacOutlet = true;
  if (PATTERNS.tokens.test(text)) tags.tokens = true;
  if (
    PATTERNS.artifactsMatter.test(text) ||
    (type.includes("artifact") && !isLand && cmc <= 3 && tags.ramp)
  )
    tags.artifactsMatter = true;
  if (
    PATTERNS.spellslinger.test(text) ||
    ((isInstant || isSorcery) && (tags.draw || tags.removal))
  ) {
    if (PATTERNS.spellslinger.test(text)) tags.spellslinger = true;
  }
  if (PATTERNS.graveyard.test(text) || tags.reanimate) tags.graveyard = true;
  if (PATTERNS.lifegain.test(text)) tags.lifegain = true;
  if (PATTERNS.drain.test(text) || tags.punisher || tags.burnFace) tags.drain = true;
  if (PATTERNS.landfall.test(text)) tags.landfall = true;
  if (
    PATTERNS.landBuffingReanimation.test(text) ||
    PATTERNS.landBuffingScaling.test(text) ||
    PATTERNS.landBuffingMassSearch.test(text)
  ) {
    tags.landBuffing = true;
  }
  if (PATTERNS.counters.test(text)) tags.counters = true;
  if (PATTERNS.minusCounters.test(text)) {
    tags.minusCounters = true;
    tags.counters = true;
  }
  if (PATTERNS.impulseDraw.test(text)) {
    tags.impulseDraw = true;
    tags.draw = true;
  }
  if (PATTERNS.exileMatters.test(text)) tags.exileMatters = true;
  if (PATTERNS.blink.test(text)) tags.blink = true;
  if (
    isPermanent &&
    PATTERNS.engine.test(text) &&
    (tags.draw || tags.ramp || tags.aristocrats || tags.tokens || tags.drain || tags.punisher)
  ) {
    tags.engine = true;
  }

  // Interaction quality
  const name = card.n || "";
  if (FREE_INTERACTION_NAMES.some((f) => name === f || name.startsWith(f))) {
    tags.freeInteraction = true;
  }
  const isInteraction =
    tags.removal || tags.counterMagic || tags.wipe || tags.stax || tags.discard || tags.protection;
  if (isInteraction && !tags.freeInteraction) {
    if (cmc <= 2) tags.cheapInteraction = true;
    else if (cmc >= 4) tags.expensiveInteraction = true;
    else tags.cheapInteraction = true; // 3-mana still relatively efficient
  }

  return {
    ...tags,
    isLand,
    isCreature,
    isInstant,
    isSorcery,
    isPermanent,
    cmc,
    gameChanger: !!card.g,
    banned: !!card.b,
    name: card.n,
  };
}
