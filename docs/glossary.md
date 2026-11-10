# PodMates glossary

Terms used in [the overview](overview.md) and the current `index.html` UI.
These describe current behaviour, not promises about the refactored architecture.

| Term                    | Meaning                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Commander               | MTG's singleton multiplayer format; also the legendary card leading a deck and setting its colour identity.               |
| Pod                     | A playgroup with shared membership, settings and activity; not a single game's seating arrangement.                       |
| MyPods                  | The signed-in social area for pods, shared decks and game nights.                                                         |
| Gathering               | A scheduled game night with invitations, RSVPs, seats, table formations and live/end states.                              |
| Chronicle               | A pod's saved match record: results, notes, lessons and feedback; the UI also calls these Chronicles & Stories.           |
| Bracket                 | Official Commander Brackets signals inferred from deck contents, separate from the app's five-axis profile.               |
| Game Changer            | A card on the official Commander Game Changers list used in bracket checks; not a pod-defined Impact card.                |
| Impact card             | A default or pod-nominated high-impact card. Pod customisations affect only the separate Pod view, never the main scores. |
| Spark / Command Spark   | The weighted aggregate of Speed, Consistency, Versatility, Disruption and Power Level; not a win probability.             |
| Centrality              | Commander Centrality: how strongly a deck depends on its commander, rather than raw commander strength.                   |
| precon                  | A publisher's ready-to-play preconstructed Commander deck; also a reference tier and Try a Deck sample category.          |
| cEDH                    | Competitive Commander: decks built for highly optimised play, also used as a reference-corpus tier.                       |
| Try-a-Deck / Try a Deck | The sample-deck picker, including curated decks and official precons, usable without a real account.                      |
| PriceScry               | Card price history and speculation tool with yen prices and separate data pipelines; its password is only a soft gate.    |
| Deck Chart              | The single-deck analysis workflow, from pasted/imported decklist to result panels.                                        |
| Deck Profile            | The radar profile showing the five axes and their reference-corpus percentile/tier placements.                            |
| Speed                   | Profile axis describing how quickly a deck develops and threatens its game plan.                                          |
| Consistency             | Profile axis describing how reliably a deck accesses and executes its plan.                                               |
| Versatility             | Profile axis describing the range of situations a deck can handle.                                                        |
| Disruption              | Profile axis describing the deck's tools for interfering with opponents.                                                  |
| Power Level             | Profile axis describing the deck's strength signals; not interchangeable with its bracket or Spark.                       |
| Deck Crafter            | In-app search-and-add deck builder, also labelled Build a Deck.                                                           |
| Full Ledger             | The MyPods table of saved decks owned by you or shared with your pod; distinct from PriceScry's Ledger tab.               |
| Pod Comparison          | Side-by-side charting of up to six decks.                                                                                 |
| Pod view                | The additional profile line reflecting the pod's Impact card settings without changing baseline scores.                   |
| Spoiler Bait            | Voting on newly revealed cards as "bang" or "bin", with aggregated pod votes.                                             |
| Reference corpus        | The calibration collection used for axis percentiles and tiers; separate from the Try a Deck library.                     |
| Commander Spellbook     | The external combo source whose offline snapshot supplements hand-curated combos.                                         |
| Commander Track Record  | The panel showing external commander win-rate data from Playgroup.gg, not this pod's Chronicles.                          |
| Colour identity         | The commander's allowed deck colours, used in structure and legality checks.                                              |
| Table formation         | A saved seating/table arrangement used when organising Gatherings.                                                        |
| Secret deck             | A saved deck hidden from pod sharing; it remains in the owner's Firestore data.                                           |
| My Data                 | Download/restore backup for saved decks; not an automatic offline copy of cloud data.                                     |
