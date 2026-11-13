# 034: Refresh the precon benchmarks (Closest Match, staples and mana base)

Date: 2026-11-13

## Summary

The Deck Chart compares every deck with the app's 178 precon and curated sample decks. It shows the closest
match, compares staple counts with that archetype's usual numbers, and rates the mana base against decks of the
same colours. Those comparison files were made with an older version of the scoring code and left out the four
2026 Star Trek precons. They are now rebuilt from today's code over all 178 decks, and the script that rebuilds
them lives in the repo. The radar scores, Command Spark and bracket don't change.

## What users see

- **Closest Match** can now name the four Star Trek decks (Federation Fleet, We Are the Borg, Klingon Fury,
  Landing Party). Across the 178 sample decks, judged against the others, 14 get a different closest match and 7
  of those a different archetype:

  | Sample deck              | Was                                   | Now                                  |
  | ------------------------ | ------------------------------------- | ------------------------------------ |
  | cmd2014-sworntodarkness  | Graveyard Overdrive (Reanimator)      | Miracle Worker (Blink & ETB)         |
  | cmd2020-sneakattack      | Dungeons of Death (Reanimator)        | Obscura Operation (Mill & Self-Mill) |
  | cmd2021-planarportal     | Sworn to Darkness (Aristocrats)       | Klingon Fury (Tribal & Typal)        |
  | cmd2023-blastfromthepast | Stalwart Unity (Group Hug & Politics) | Klingon Fury (Tribal & Typal)        |
  | cmd2023-ahoymateys       | Family Matters (Tokens & Go-Wide)     | Miracle Worker (Blink & ETB)         |
  | cmd2026-doomprevails     | Paradox Power (Spellslinger)          | Obscura Operation (Mill & Self-Mill) |
  | cmd2026-oddsandends      | Peer Through Time (Stax & Control)    | Federation Fleet (Artifacts Matter)  |

  A deck whose archetype changes is also measured against that archetype's staples baseline.

- **Staples check** baselines move only where the Star Trek decks were added: Artifacts Matter (13 → 15 decks,
  removal 5 → 7), Tribal & Typal (34 → 35; ramp 11.5 → 11, protection 2.5 → 3), Land Matters & Landfall (6 → 7;
  sac outlets 8 → 7, ramp 16 → 14, removal 7.5 → 7, protection 1.5 → 2).
- **Mana base** buckets: WBR (8 → 9 decks, median fixing 0.562 → 0.576), WUR (12 → 13; 0.561 → 0.556, nonbasics
  21 → 22), WUG (7 → 8; 0.574 → 0.565), WUB (11 → 12; 0.600 → 0.595, nonbasics 23 → 23.5), 3-colour decks 83 → 87.
- The Closest Match and Mana Base explainers now say 178 decks and 177 coloured decks (were 174 and 173).

## How it works

- `pipelines/reference-corpus/benchmark-baselines.mjs` now builds all three files. `deckFeatures()` adds
  `buildFingerprintVector(agg)` per sample (the vector the page builds for the charted deck), and
  `buildBenchmarkFiles()` checks shapes (at least 150 decks, 27 finite numbers per vector, all five colour-count
  buckets) before anything is written. `--update-public-data` writes `public/data/` and refreshes the three
  manifest entries (source `pipelines/reference-corpus/benchmark-baselines.mjs`). The Nov 3 four-deck exclusion
  and `--all-samples` are gone; every sample is in the fit.
- Fingerprints: 4 added, 51 refreshed (they predated later engine changes), 123 identical. Order stays sample
  order.
- Data: `public/data/PRECON_FINGERPRINTS.json`, `STAPLES_BASELINE.json`, `MANABASE_BASELINE.json` and their
  `manifest.json` entries, all written by the builder, never by hand. Same schemas. No Firestore changes.
- Text: `src/features/deck-chart/explainers/explainer-text.ts` (counts), and a comment in `src/engine/benchmarks.ts`.

## Testing

- `benchmark-baselines.test.mjs` now requires each committed file to equal the builder's output from the pinned
  golden fixtures (all three byte for byte), covers every sample in order, and rejects implausible input.
- No golden output changes: `git diff --stat -- tests/golden` is empty. The engine's scoring code is untouched;
  only the benchmark data it is given changed, and golden snapshots don't include benchmarks.
- `npm run check`: 764 tests pass. The impact table above came from charting each sample against the old and new
  fingerprints, leaving out the deck itself.
- By hand after deploy: chart a Star Trek precon from Try a Deck (or a deck like it). Closest Match can name
  another Star Trek deck, and the Mana Base and Closest Match explainers say 177/178.

## Risks and rollback

This is a deliberate calibration change. Some players will see a different Closest Match or staples comparison
for the same deck. Nothing else in the scores moves. Roll back with `git revert <sha>`; the builder then fails
its test against the restored files until the revert also restores the builder.

## Follow-ups

- When new precons are added to Try a Deck, the builder's test fails until the benchmarks are refit, so they
  can't silently go stale. See the discussion of an automatic precon importer.

## Related

020 (baselines recovered), 007 (Try a Deck), 005 (Deck Chart).
