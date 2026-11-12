// Help text of the Synergy panel: heading tooltips and the "How was this built?" note.
// Copied unchanged from the inline panel.

export const TIPS = {
  topThemes:
    "Cards that either ARE this type, or whose text is thematically about it — e.g. Artifacts Matter includes actual artifacts plus any card that cares about artifacts entering, being cast, etc. Broader than a strict type count on purpose.",
  keyInteractions:
    "Found by reading each card's rules text: what sets off a payoff, which cards in your 100 supply it, and which cards repeat or double it. Ranked by how many cards feed it and how much it repeats, with the commander weighted highest.",
  strongest:
    "The highest-scoring card-to-card pairs in the deck: one card producing a resource the other consumes, a shared meaningful trigger, overlapping themes, or a known synergy pattern.",
  engine:
    "Cards that provide repeatable value or 2+ meaningful interactions on their own — the individual pieces driving the Engine density stat above.",
  mix: "Free = no mana cost to use. Cheap = 1-2 mana. Expensive = 3+ mana. Counts nonland interaction spells (removal, protection, counterspells, and similar) by their activation cost.",
};

/** App-authored markup (only <em> and <br>). */
export const HOW_BUILT =
  'Top Themes count cards that either <em>are</em> that type or whose text is thematically about it — e.g. "Artifacts Matter" includes actual artifacts plus any card that cares about artifacts entering, being cast, etc., so it can run higher than a strict type count elsewhere in the app; they\'re answering different questions on purpose. Every nonland card pair is checked for genuine interaction — one card producing a resource the other consumes, shared meaningful triggers, overlapping themes, or known synergy patterns (tokens feeding sacrifice outlets, etc.), plus a bonus when a card supports your commander\'s own signals. Pairs scoring high enough become an edge; "top cluster size" is the largest group of cards all connected to each other this way — a rough measure of how much of the deck is one interlocking machine versus a pile of separately-good cards. Known Synergy Pairs above come from a curated community-documented list, separate from that graph. The Engine Cards chips are color-coded by the strongest type of interaction that card participates in (see the legend beneath them) — this is a "most common reason," not the only one, since most engine cards connect to several others for several different reasons. <br><br><em>Tip: hover any underlined term above for a quick definition.</em>';
