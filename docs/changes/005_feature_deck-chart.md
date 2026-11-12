# 005: Deck Chart, the deck analysis report

Date: 2026-11-12

## Summary

Deck Chart is the heart of PodMates. You paste a Commander decklist (or load one), press **Chart Deck**, and the
site works out how fast, consistent, versatile, disruptive and powerful the deck is, draws it on a radar, and
explains the result in a stack of panels: win condition, closest known deck, table vibe, bracket signals, mana,
key combos, synergy, commander record, centrality and legality. Everything is worked out in the browser from the
card database; nothing is saved. This doc describes the feature as it is after the refactor (`004`).

## What users see

On the **Deck Chart** tab (the default mode), below the deck form, **Chart Deck** (`#chartBtn`, enabled once the
card database is ready) fills `#resultsSection` ("Deck Profile") and scrolls to it:

- **Radar** (`#chartArea`) with the five axes and the **Command Spark** score, the commander portraits above it
  (drawn by the card viewer, `011`) and the Impact "Pod view" line under it (`018`).
- **Key Pieces & Combos**, **Mana Curve — Expected Available Per Turn**, **Win Condition & Table Vibe** (win
  condition, closest match, table vibe), **Official Bracket Signals**, **Card Type Frequency & Curve**, **Mana Base:
  Cost vs. Production**, **Synergy Profile** (with "Card Links & Packages" and the **Cards you could add ›** sheet),
  **Commander Track Record**, **Commander Centrality** and **Structure & Legality** (badge `#legalityBadge`).
- Every panel has a **?** button that opens a "How was this built?" dialog, and a collapsible footnote.
- The status line (`#status`) summarises the count, commander, Game Changers and combo lines; unmatched names and
  typo fixes appear in `#notFoundBox`; hard legality violations open a popup.

## How it works

Entry: `src/features/deck-chart/index.ts` `mount(ports)` binds Chart Deck, the explainer and suggestion clicks and
the radar redraw, and returns `runAnalysis`. `src/app/deck-chart.ts` mounts it and registers that function as the
shared chart runner (`setChartRunner` in `services/current-chart.ts`), so other features chart through
`runChart()`.

Files:

- `run-analysis.ts`: reads `#decklistInput` / `#commanderInput`, loads the lazy analysis datasets, parses and matches
  the list, picks the commander (field, then paste section, then heuristic; fills the field and Deck Name), runs the
  engine scores and paints every panel.
- `state.ts`: pure legality rules (copy limits read from card text plus a fallback table, colour identity, partners)
  and the mana-base rows. `view.ts`: shared template bits (`renderInto`, `?` button, footnote).
- `panels/`: Structure & Legality, Mana Curve, Mana Base, Card Type table (prefix `dc-`, `deck-chart.css`).
- `results/`: radar, win condition, closest match, table vibe, bracket, not-found box, legality popup (prefix `rs-`,
  `results/results.css`).
- `report.ts` with `key-pieces/`, `synergy/`, `centrality/` and `explainers/` (`report.css`, prefixes `kp-`,
  `syn-`, `tr-`, `cc-`, `ex-`).
- `interactions/` (prefix `ix-`): the display-only interaction reading (trigger/rule packages, deck and theme
  plans, Super Friends, conditional and idle cards) and the "Cards you could add" sheet. Nothing here feeds a score.

Ports (`DeckChartPorts`, from `src/app/deck-chart.ts`): `dbReady`, `indexes`, `deckListProblem`
(`services/decklist-limits`), `autoFillDeckName` (`services/deck-form`), `availableSampleDecks`, `cards`, `tags`,
`loadKnowledge`, `knowledge` (all from `services/card-data`).

Events: emits `chart:commanders` (portraits) and `chart:radar` (Impact's caption mount). The charted deck, scores
and bracket are stored in `services/current-chart.ts` for Impact, export, the type galleries and the explainers.

Data: no Firestore and no local storage. Uses the card DB, Spellbook snapshot, commander win-rates and Tagger tags
(boot), the reference scores/tiers and baselines (boot, `services/reference-data.ts`), and lazily
`PRECON_FINGERPRINTS` / Try-a-Deck metadata on the first chart and `KNOW_JSON` when the suggestions sheet opens.
Scoring itself is the engine (`src/engine/`, calibrated; see `src/engine/CLAUDE.md`).

## Testing

- Unit: `deck-chart.test.ts` (copy limits, legality, mana-base rows), `report.test.ts` (combo text, Key Pieces,
  explainers, centrality/track record), `results/results.test.ts`, `interactions/interactions.test.ts`.
- Golden: `npm run golden` pins the engine output for all 178 samples; any score change shows there.
- e2e: `smoke.spec.ts` (sample deck charts, pasted list analyses, radar and panels), `lazy-data.spec.ts` (datasets
  load on first chart / when suggestions open), `accessibility.spec.ts` (expanded panels).
- By hand: open the site, wait for "ready", press Try a Deck, pick any deck, press Chart Deck. Check the radar,
  expand every panel, press a **?**, open **Cards you could add ›**. Paste a list with a typo and see the fix offered.

## Risks and rollback

Display bugs show on the live site only; scores are protected by golden. Any change to scoring goes through
`/engine-change`. Roll back with `git revert` or Deploy Pages with an older `ref`.

## Follow-ups

- Package text from `ixDescribePackage` is still app-built markup inserted with a commented `trustedHtml`.
- The teal `warp` combo badge misses contrast by 0.05 (design-deferred, `docs/architecture.md` "Accessibility").

## Related

`004` (refactor summary); `011` (card viewer: portraits, View Deck, galleries); `src/engine/CLAUDE.md`.
