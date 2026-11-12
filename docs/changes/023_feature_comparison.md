# 023: Pod Comparison (decks at one table)

Date: 2026-11-12

## Summary

Pod Comparison puts up to six decks side by side, so a playgroup can see before a game whether the table is fair.
It shows a summary banner, whether the decks are aligned ("Rule Zero"), where they clash, a strongest-to-weakest
ranking, how each axis compares, which decks are fast or hard to interact with, and a mini radar per deck. It
appears on the MyPods tab after a Gathering is charted or the sample table runs. Scores are the normal Deck Chart
scores; nothing here changes them.

## What users see

On the **MyPods** tab, `#podResultsSection`:

- A **summary banner** (average Command Spark, spread).
- **Table Alignment**: aligned or not, mismatches, and up to three optional nudges to balance the table.
- **Seats at a Glance**: decks ranked by Command Spark, with seat colours; tap one for a **deck detail** dialog
  (closest match and analysis; data loads on demand).
- **How We Differ**: axis-by-axis table, plus pace and interaction risk notes (sudden tables, low-agency tables).
- **Archetype Matchup Radar** (pace radar) and **Each Deck's Shape** (one mini radar per deck).
- Under it: Chronicles' battle controls (`017`) when the decks came from a Gathering.

## How it works

- `index.ts`: `mount(host, ports)` renders the shell and returns `ComparisonView` (`show(decks)` paints every panel
  and returns `{ avgSpark, spread }`; `destroy()`). Detail dialogs check they are still current before painting.
- `state.ts`: pure table statistics, summary and mismatch signals; sorts without mutating the input; never alters
  engine scores. `guidance.ts`: optional nudges (existing thresholds, at most three).
- `view.ts`, `balance-view.ts`, `charts.ts` (SVG radars, original geometry), `detail.ts` (deck detail via the shared
  modal). CSS: `comparison.css`, `detail.css`; fixed tier colours are tokens, only seat colours are inline.

Ports (`DetailPorts`, from `src/app/comparison.ts`): `loadDatasets` (`loadAnalysisDatasets` for fingerprints and
metadata) and `archetype` (`archetypeMatch`). The app registers the mounted view as the battle results view
(`provideComparisonView` in `src/app/battle.ts`); `showPodResults(decks)` there sorts the decks by Command Spark,
stores them as the current battle's decks and refreshes the Chronicles journal. Gatherings and Chronicles call it
through their `results` ports.

Events: none.

Data: no Firestore and no local storage. Each deck's analysis comes from `services/deck-analysis.ts` (the shared
decklist-to-analysis pipeline, also used by profiles and the decks table); deck detail lazily loads
`PRECON_FINGERPRINTS` and Try-a-Deck metadata.

## Testing

- Unit: `comparison.test.ts` (sorting without mutation, alignment and nudge thresholds, sudden and low-agency tables
  with unchanged scores, escaping, ranked deck opens, dismissed details cancelled).
- e2e: `comparison.modules.spec.ts` (the six-deck sample renders every panel, opens a ranked deck and restores the
  mode).
- By hand: MyPods → **Sample a Gathering**; expand each panel and tap the top-ranked deck.

## Risks and rollback

Display only. Roll back with `git revert`.

## Follow-ups

- `index.ts` says "ports bridge the remaining inline datasets"; there are no inline datasets any more (stale
  comment).
- Comparison and Gathering deck types are cast in `src/app/` (`docs/architecture.md`, "What is not done yet").

## Related

`004`, `005` (the same scores), `016` (Gatherings and the sample table), `017` (battle controls and journal).
