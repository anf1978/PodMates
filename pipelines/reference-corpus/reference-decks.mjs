// Reads the committed tuned and cEDH reference decks (reference-decks.json + decks/<tier>/<key>.txt,
// fetched by fetch-reference-decks.mjs) in manifest order: the 30 tuned decks, then the 20 cEDH lists.
// The reference set (benchmark-baselines.mjs) and the golden fixture generator both use this.
import { readFileSync } from "node:fs";

/**
 * @typedef {{ key: string, tier: "t" | "c", archetype: string, commander: string, decklist: string,
 *   source: string }} ReferenceDeck
 */

/** @param {"t" | "c"} tier */
export function referenceDeckDir(tier) {
  return new URL(`./decks/${tier === "t" ? "tuned" : "cedh"}/`, import.meta.url);
}

/** @returns {ReferenceDeck[]} */
export function readReferenceDecks() {
  const manifest = JSON.parse(
    readFileSync(new URL("./reference-decks.json", import.meta.url), "utf8"),
  );
  const decks = manifest.decks.map((/** @type {any} */ deck) => {
    if (deck.tier !== "t" && deck.tier !== "c")
      throw new Error(`${deck.key}: bad tier ${deck.tier}`);
    if (!deck.commander || !deck.archetype)
      throw new Error(`${deck.key}: commander/archetype missing`);
    return {
      key: deck.key,
      tier: deck.tier,
      archetype: deck.archetype,
      commander: deck.commander,
      decklist: readFileSync(new URL(`${deck.key}.txt`, referenceDeckDir(deck.tier)), "utf8"),
      source: deck.tier === "t" ? "reference-tuned" : "reference-cedh",
    };
  });
  const tiers = decks.map((d) => d.tier).join("");
  if (!/^t+c+$/.test(tiers))
    throw new Error("Reference decks must list every tuned deck before the cEDH lists");
  return decks;
}
