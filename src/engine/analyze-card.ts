import { castabilityWeight } from "./axes/shared.ts";
import { classifyCard, normalizeText, stripReminderText } from "./classify.ts";
import { deriveManaProduction } from "./mana.ts";
import { REAL_CARD_TYPES, VERSATILITY_FEATURE_KEYS } from "./synergy.ts";
import type { DeckAnalysis } from "./analyze-tallies.ts";
import type { DeckEntry } from "./types.ts";

/** What the per-card pass needs to know about the deck as a whole. */
export interface DeckFrame {
  /** Commander card names; the commander is not part of the 99-card library. */
  commanderCardNames: Set<string>;
  /** Colors the deck can actually cast. */
  colorIdentity: Set<string>;
}

/** Library-only totals and versatility inputs gathered alongside the deck totals. */
export interface CardPassTotals {
  cmdrNonland: number;
  cmdrCmcSum: number;
  cmdrEarly: number;
  cmdrEngine: number;
  versatilityFeatures: Set<string>;
  versatilityModes: number;
}

/** Adds one decklist line to the running totals. */
export function tallyCard(
  agg: DeckAnalysis,
  t: CardPassTotals,
  deck: DeckFrame,
  { qty, card }: DeckEntry,
): void {
  const c = classifyCard(card);
  const isCmdr = deck.commanderCardNames.has(card.n);
  agg.totalCards += qty;

  if (c.isLand) {
    agg.landCount += qty;
  } else {
    agg.nonlandCount += qty;
    agg.cmcSum += c.cmc * qty;
    const bucket = c.cmc >= 7 ? "7+" : String(Math.floor(c.cmc));
    if (agg.manaCurve[bucket] !== undefined) agg.manaCurve[bucket] += qty;
    if (c.cmc <= 2) agg.earlySpells += qty;
    if (isCmdr) {
      t.cmdrNonland += qty;
      t.cmdrCmcSum += c.cmc * qty;
      if (c.cmc <= 2) t.cmdrEarly += qty;
    }

    // Voltron signal: Auras and Equipment specifically (not just any
    // permanent), tracked by type line since neither has a dedicated
    // oracle-text regex tag — the subtype itself is the signal.
    const typeLine = (card.t || "").toLowerCase();
    if (typeLine.includes("aura")) agg.auraCount += qty;
    if (typeLine.includes("equipment")) agg.equipmentCount += qty;

    // Colored pip requirements: only nonland spells have a real casting cost
    if (card.p) {
      const pipMatches = card.p.match(/[WUBRGC]\d+/g) || [];
      for (const pm of pipMatches) {
        const color = pm[0];
        const halfPips = parseInt(pm.slice(1), 10);
        agg.manaPipsRequired[color] = (agg.manaPipsRequired[color] || 0) + (halfPips / 2) * qty;
      }
    }
    if (!card.ci) agg.colorlessNonlandCount += qty;
  }

  // Mana production: only count PERMANENT sources (lands, rocks, dorks, mana
  // enchantments/planeswalkers) toward the sustained mana base. One-time
  // rituals (Dark Ritual, etc.) still show real mana on resolution, but
  // they're not part of an ongoing base — tracked separately instead.
  const mp = deriveManaProduction(card);
  if (mp.produces) {
    if (mp.ritual) {
      agg.ritualCards.push(card.n);
    } else {
      const produced = new Set(mp.colors.split(""));
      if (mp.any) for (const col of ["W", "U", "B", "R", "G"]) produced.add(col);
      for (const color of produced) {
        // A source only matters for colors the deck can actually cast:
        // Birds of Paradise "can" make red, but in a mono-green deck that
        // is not a red source worth counting.
        if (color !== "C" && deck.colorIdentity && !deck.colorIdentity.has(color)) continue;
        if (agg.manaSourcesAvailable[color] !== undefined) {
          agg.manaSourcesAvailable[color] += qty;
          agg.manaSourceCards[color].push(card.n);
        }
      }
    }
  }

  if (c.ramp) {
    agg.ramp += qty;
    agg.rampCards.push(card.n);
    agg.rampWeighted += qty * castabilityWeight(card.m || 0);
  }
  // Gathered here (not lands -- those use agg.landCount directly) for the
  // mana curve model: each contributor's own CMC (when it could come
  // online) and an estimated mana output. No quantity field exists for
  // arbitrary cards, so this uses a deliberately simple, uniform tiered
  // estimate (fast mana/land engines ~2, everything else 1, multipliers
  // as a percentage boost rather than additive) -- consistent across
  // every deck being compared is what matters here, not precision on any
  // single card.
  if (!c.isLand && (c.ramp || c.fastMana || c.manaDork || c.manaRock)) {
    const output = c.manaMultiplier ? 0 : c.fastMana || c.fastManaExtended || c.landEngine ? 2 : 1;
    for (let i = 0; i < qty; i++) {
      agg.manaCurveContributors.push({
        cmc: card.m || 0,
        output,
        isMultiplier: !!c.manaMultiplier,
        isCommander: isCmdr,
      });
    }
  }
  if (c.fastMana) {
    agg.fastMana += qty;
    agg.fastManaCards.push(card.n);
  }
  if (c.fastManaExtended) {
    agg.fastManaExtended += qty;
  }
  if (c.manaDork) agg.manaDork += qty;
  if (c.manaRock) agg.manaRock += qty;
  if (c.extraLand) agg.extraLand += qty;
  if (c.manaEnchantment) agg.manaEnchantment += qty;
  if (c.treasureRamp) agg.treasureRamp += qty;
  if (c.ritual) agg.ritual += qty;
  if (c.manaMultiplier) {
    agg.manaMultiplier += qty;
    agg.manaMultiplierWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.untapper) agg.untapper += qty;
  if (c.costReducer) {
    agg.costReducer += qty;
    agg.costReducerWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.sacrificeMana) agg.sacrificeMana += qty;
  if (c.landEngine) {
    agg.landEngine += qty;
    agg.landEngineWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.castTriggerPayoff) agg.castTriggerPayoff += qty;
  if (c.creatureEventPayoff) agg.creatureEventPayoff += qty;
  if (c.draw) {
    agg.draw += qty;
    agg.drawCards.push(card.n);
    agg.drawWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.removal) {
    agg.removal += qty;
    agg.removalWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.wipe) {
    agg.wipe += qty;
    agg.wipeWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.protection) {
    agg.protection += qty;
    agg.protectionCards.push(card.n);
    agg.protectionWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.counterMagic) {
    agg.counterMagic += qty;
    agg.counterCards.push(card.n);
    agg.counterMagicWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.stax) {
    agg.stax += qty;
    agg.staxCards.push(card.n);
    agg.themes.stax += qty;
    agg.staxWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.discard) {
    agg.discard += qty;
    agg.discardCards.push(card.n);
    agg.discardWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.mld) {
    agg.mld += qty;
    agg.mldCards.push(card.n);
    agg.mldWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.extraTurn) {
    agg.extraTurn += qty;
    agg.extraTurnWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.tutor) {
    agg.tutor += qty;
    agg.tutorCards.push(card.n);
    agg.tutorWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.sac) {
    agg.sac += qty;
    agg.sacCards.push(card.n);
  }
  if (c.reanimate) {
    agg.reanimate += qty;
    agg.reanimateCards.push(card.n);
    agg.reanimateWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.punisher) {
    agg.punisher += qty;
    agg.punisherWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.altWin) agg.altWinCards.push(card.n);
  if (c.millOpponent) agg.millOpponentCount += qty;
  if (c.millSelf) agg.millSelfCount += qty;
  if (c.burnFace) agg.burnFaceCount += qty;
  if (c.infect) agg.infectCount += qty;
  if (c.gameChanger) agg.gameChangers.push(card.n);

  if (c.aristocrats) agg.themes.aristocrats += qty;
  if (c.sacOutlet) {
    agg.sacOutlets += qty;
    agg.sacOutletsWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.tokens) agg.themes.tokens += qty;
  if (c.artifactsMatter || ((card.t || "").toLowerCase().includes("artifact") && !c.isLand))
    agg.themes.artifacts += qty;
  if (c.spellslinger) agg.themes.spellslinger += qty;
  if (c.graveyard) agg.themes.graveyard += qty;
  if (c.drain) agg.themes.drain += qty;
  if (c.lifegain) agg.themes.lifegain += qty;
  if (c.landfall) agg.themes.landfall += qty;
  if (c.landBuffing) {
    agg.themes.landBuffing += qty;
    agg.landBuffingWeighted += qty * castabilityWeight(card.m || 0);
  }
  if (c.counters) agg.themes.counters += qty;
  if (c.minusCounters) agg.themes.minusCounters += qty;
  if (c.impulseDraw) agg.themes.impulseDraw += qty;
  if (c.exileMatters) agg.themes.exileMatters += qty;
  if (c.blink) agg.themes.blink += qty;
  if (c.engine) {
    agg.engines += qty;
    if (isCmdr) t.cmdrEngine += qty;
  }
  if (c.freeInteraction) {
    agg.freeInteraction += qty;
    agg.freeInteractionCards.push(card.n);
  }
  if (c.cheapInteraction) agg.cheapInteraction += qty;
  if (c.expensiveInteraction) agg.expensiveInteraction += qty;

  // Versatility inputs: distinct functional capabilities plus meaningful modes.
  VERSATILITY_FEATURE_KEYS.forEach((k) => {
    if (c[k]) t.versatilityFeatures.add(k);
  });
  // Audited against the full ~32k-card database before this fix: ~30% of
  // all nonland cards matched, with bare "may" alone responsible for ~73%
  // of matches and a measured ~85%+ false-positive rate in that bucket
  // (almost entirely reminder text for surveil/scry/morph/kicker/disturb/
  // partner, or a single take-it-or-leave-it optional trigger rather than
  // a real choice between modes) -- versus near-100% precision for "choose
  // one/two/any" and "up to". "instead" removed entirely: sampled near-0%
  // precision, almost all replacement-effect/reminder-text noise (stun
  // counters, "put on library instead of graveyard," etc.), and every
  // genuine modal card sampled that used "instead" phrasing also matched
  // "choose one" independently, so it added noise without adding signal.
  //
  // Bare "may" was tried and rejected too broad even with reminder text
  // stripped (still ~65% false-positive on a second audit pass); replaced
  // with the tightened "may X ... if you don't, Y" tradeoff structure,
  // which specifically requires an explicit stated consequence for
  // declining -- a genuine two-outcome choice, not just "this trigger
  // happens to be optional." Sampled at ~100% precision across 40+ cards
  // (Chaos Spewer, Knight of the Mists, Choice of Damnations, etc.) and
  // recovers 73 of the 74 real matches bare "may" was catching, while
  // dropping ~4,220 more false-positive cards versus bare "may". Several
  // narrower alternatives ("may ... or", two separate "may" clauses) were
  // also tried and rejected: sampled at only ~15-30% precision, mostly
  // matching noun-list "or"s ("artifact or enchantment," "and/or") or
  // unrelated sequential triggers rather than genuine modal branching.
  //
  // Reminder text is stripped first so keyword-explanation boilerplate
  // doesn't get counted as if it were the card's own modality.
  if (
    !c.isLand &&
    /\bchoose one\b|\bchoose two\b|\bchoose any\b|\bup to\b|\bmay\b[\s\S]{0,120}\bif you don'?t\b/i.test(
      stripReminderText(normalizeText(card.o)),
    )
  ) {
    t.versatilityModes += qty;
  }

  // Card type frequency: credit every real card type a card has (an "Artifact
  // Creature" counts toward BOTH Artifact and Creature), not just the last
  // word in its type line — the previous "last word wins" approach silently
  // dropped a card's other types whenever it had more than one.
  // cardsByType is built in this SAME loop, crediting the same way, so its
  // per-type card lists are always exactly consistent with the counts
  // shown in typeFrequency -- lets the UI offer "show me the cards behind
  // this number" without a second, separately-derived pass that could
  // drift out of sync with what's actually displayed.
  const typeLinePrefix = (card.t || "").split("—")[0].trim();
  const wordsInType = typeLinePrefix.split(/\s+/).filter(Boolean);
  const realTypesFound = wordsInType.filter((w) => REAL_CARD_TYPES.has(w));
  if (realTypesFound.length === 0) {
    agg.typeFrequency["Unknown"] = (agg.typeFrequency["Unknown"] || 0) + qty;
    (agg.cardsByType["Unknown"] = agg.cardsByType["Unknown"] || []).push({ name: card.n, qty });
  } else {
    for (const t of realTypesFound) {
      agg.typeFrequency[t] = (agg.typeFrequency[t] || 0) + qty;
      (agg.cardsByType[t] = agg.cardsByType[t] || []).push({ name: card.n, qty });
    }
  }
}
