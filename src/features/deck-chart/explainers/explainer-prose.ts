// Static prose of the Spark and Commander Centrality explainers (app-authored markup: only
// <strong> and <em>). Copied unchanged from the inline builders.

export const CC_INTRO =
  "Centrality shows how much this deck is <strong>built around its commander</strong>, as opposed to simply being led by it. Two things feed it: what the commander does for the deck, and how much the builder has invested in keeping it around. A deck full of ways to protect, recur, tutor for and cheapen its commander is telling you what its builder thinks the deck is about.";
export const CC_GRID_TITLE = "How to read the grid";
export const CC_GRID =
  "Each square is one card in the deck. The gold square with the white border is the commander. <strong>Bright gold</strong> cards are essential: part of a combo with it, or with no other synergy partner in the deck. <strong>Dim gold</strong> cards are linked: they synergize with it or match what its ability cares about. <strong>Teal</strong> cards are support (protection, recursion, tutors, cost reducers, equipment). Dark squares would work the same without it. Tap a square to see the card. The symbol inside each square shows the card type, and lands show the colours of mana they make. Tap <strong>Symbol key</strong> under the grid for the full list.";
export const CC_CALC_TITLE = "How it is calculated";
export const CC_CALC = "Five signals, each 0–100, combined by weight.";
export const CC_SIGNALS_TITLE = "What each signal means";
export const CC_SIGNALS =
  "<strong>Plan involvement</strong>: how many of the deck's detected combos include the commander. <strong>Synergy reliance</strong>: if you removed the commander from the deck's synergy web, how much of it would fall apart. <strong>Deck alignment</strong>: how much of the deck matches what the commander's ability cares about (artifacts, a creature type, counters...), compared with a typical deck. <strong>Ability type</strong>: a repeating effect counts for more than a one-time enters-the-battlefield effect. <strong>Builder investment</strong>: support cards beyond what a typical precon of the same archetype runs (a Voltron deck is expected to carry more protection than a Spellslinger deck), so generic protection like Swiftfoot Boots doesn't inflate it.";
export const CC_LIMITS_TITLE = "What it does not tell you";
export const CC_LIMITS =
  'It does not say the deck is good or bad, or that the commander is easy to answer. A high reading is a fair question for the table: "if this commander is dealt with, what does the deck do?" Bands were re-fitted on Nov 3, 2026 against the 174 precon and curated decks, which split about 24% Self-sufficient, 44% Supported, 22% Reliant and 10% All-in. Tuned and competitive decks read lower (about 40% Self-sufficient), because they run several combo routes and the commander is only part of them. The plan signal only counts when combos are detected, and it measures the share of those combos that include the commander.';
export const CC_RULES_TITLE = "How commanders work (what the scoring relies on)";
export const SP_INTRO =
  "Spark exists so a table can <strong>line up before the game starts</strong>. Commander games usually go sideways not because a deck is weak or strong, but because the decks at the table don't match. Spark boils the five axes down to one shared number so a pod can compare decks quickly and talk about it. The Pod view uses the gaps between decks' Spark scores to call a table Well Balanced, Moderate Spread, or High Variance.";
export const SP_READ_TITLE = "How to read it";
export const SP_READ =
  "Compare it to the decks you're about to play against, not to a perfect 10. A low Spark isn't a bad deck and a high one isn't a good deck; they just play different games. Two decks can share a Spark and still get there very differently, so use the radar shape to see <em>how</em> a deck plays, and Spark to see whether it <em>fits the table</em>.";
export const SP_CALC_TITLE = "How it's calculated";
export const SP_CALC =
  "Spark is a weighted average of the five axes: each score is multiplied by its weight, added up, and divided by 5. The weights add up to 5, so Spark stays on the same 1–10 scale as the axes.";
export const SP_WEIGHTS_TITLE = "Why the weights are uneven";
export const SP_WEIGHTS =
  "The radar draws five equal rings, but Spark doesn't count the axes equally. Power Level and Disruption count the most because they decide most directly whether a deck dominates or overwhelms a table. Speed, Consistency, and Versatility count less: they show how smoothly a deck runs, which matters, but a smooth deck isn't automatically a scary one. The weights were checked against a spread of decks from weak precons up to near-cEDH lists. They are a design judgment, not a law of nature, which is why the breakdown is shown here.";
export const SP_LIMITS_TITLE = "What it doesn't measure";
export const SP_LIMITS =
  "Who is piloting the deck, table politics, how the decks interact with each other, or whether a deck is fun to play against. It's a conversation starter, not a verdict, and not a grade on you or your deck. If your commander has enough tracked games, a badge under Spark also compares it with that commander's real win-rate history.";
