import { tallyCard } from "./analyze-card.ts";
import type { CardPassTotals } from "./analyze-card.ts";
import { detectDeckCombos } from "./analyze-combos.ts";
import { createDeckTallies } from "./analyze-tallies.ts";
import type { DeckAnalysis } from "./analyze-tallies.ts";
import { resolveCommanderName } from "./commanders.ts";
import type { EngineContext } from "./context.ts";
import { buildSynergyModel } from "./synergy.ts";
import type { DeckEntry } from "./types.ts";

/** Analyses a matched decklist. Pure: reads card, Spellbook and win-rate data only from `ctx`. */
export function analyzeDeck(
  ctx: EngineContext,
  matchedCards: DeckEntry[],
  commanders: string[] = [],
): DeckAnalysis {
  // Banned cards can't be played in Commander, so they are listed (and
  // flagged in the Bracket panel) but left out of every score, count, combo
  // and curve below. A deck full of banned fast mana used to score as if it
  // could cast it.
  const bannedEntries = matchedCards.filter((m) => m.card && m.card.b);
  matchedCards = matchedCards.filter((m) => !(m.card && m.card.b));
  const agg = createDeckTallies() as DeckAnalysis;

  agg.bannedCards = bannedEntries.map((m) => m.card.n);
  agg.bannedCount = bannedEntries.reduce((a, m) => a + (m.qty || 1), 0);
  const namesInDeck = new Set(matchedCards.map((m) => m.card.n));
  agg.deckCardNames = Array.from(namesInDeck);
  const nameToCard = new Map(matchedCards.map((m) => [m.card.n, m.card]));
  // The commander is not part of the 99-card library: it is available every
  // game (no drawing needed). Its names are collected so the library-based
  // ratios and the mana curve can treat it separately.
  const commanderCardNames = new Set<string>();
  for (const name of commanders || []) {
    const cc = nameToCard.get(name) || resolveCommanderName(ctx, name, matchedCards);
    if (cc) commanderCardNames.add(cc.n);
  }
  // The colors this deck can actually cast: the commander's color identity
  // when a commander is known, otherwise the colors found on its nonland cards.
  const deckColorIdentity = (() => {
    const set = new Set<string>();
    let commanderFound = false;
    for (const name of commanders || []) {
      const cc = nameToCard.get(name) || resolveCommanderName(ctx, name, matchedCards);
      if (cc) {
        commanderFound = true;
        for (const ch of cc.ci || "") set.add(ch);
      }
    }
    if (commanderFound) return set;
    for (const { card } of matchedCards) {
      if (/\bland\b/i.test(card.t || "")) continue;
      for (const ch of card.ci || "") set.add(ch);
    }
    if (!set.size) for (const { card } of matchedCards) for (const ch of card.ci || "") set.add(ch);
    return set;
  })();
  const t: CardPassTotals = {
    cmdrNonland: 0,
    cmdrCmcSum: 0,
    cmdrEarly: 0,
    cmdrEngine: 0,
    versatilityFeatures: new Set(),
    versatilityModes: 0,
  };

  const frame = { commanderCardNames, colorIdentity: deckColorIdentity };
  for (const entry of matchedCards) tallyCard(agg, t, frame, entry);

  agg.avgCmc = agg.nonlandCount > 0 ? agg.cmcSum / agg.nonlandCount : 0;
  const nl = Math.max(agg.nonlandCount, 1);
  // Scoring ratios are measured on the library (the commander is always
  // available, so it is not "a card in the deck" for density purposes). The
  // raw counts and the displayed Avg. CMC still include every card.
  const libNonland = Math.max(agg.nonlandCount - t.cmdrNonland, 1);
  agg.avgCmcLibrary =
    agg.nonlandCount - t.cmdrNonland > 0 ? (agg.cmcSum - t.cmdrCmcSum) / libNonland : agg.avgCmc;
  agg.earlyDensity = (agg.earlySpells - t.cmdrEarly) / libNonland;
  agg.engineRatio = (agg.engines - t.cmdrEngine) / libNonland;
  agg.themeScores = Object.entries(agg.themes)
    .map(([k, v]) => ({ theme: k, count: v, density: v / nl }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.density - a.density);
  agg.topThemes = agg.themeScores.slice(0, 3);
  // Redundancy: strongest theme cluster size (distinct from the pairwise synergy
  // cluster below — this is a bag-of-words theme measure, that's a real interaction graph)
  agg.redundancy = agg.themeScores.length ? agg.themeScores[0].count : 0;

  detectDeckCombos(ctx, agg, { namesInDeck, nameToCard, commanders, matchedCards });

  agg.versatilityFeatures = t.versatilityFeatures.size;
  agg.versatilityModes = t.versatilityModes;

  const synergy = buildSynergyModel(matchedCards, commanders);
  agg.synergyEdges = synergy.edges;
  agg.synergyEngineCards = synergy.engineCards;
  agg.synergyEngineCount = synergy.engineCount;
  agg.synergyTopClusterSize = synergy.topClusterSize;
  agg.commanderAlignment = synergy.commanderAlignment;

  return agg;
}
