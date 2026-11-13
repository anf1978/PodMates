# 035: Rebuild the reference set's precon rows from the sample decks

Date: 2026-11-13

## Summary

The percentiles on the Deck Chart radar compare your deck with 224 reference decks: 168 precons, 36 tuned decks
and 20 cEDH lists. The script that made that list was lost. Today's scoring code reproduces all 174 precon and
curated rows exactly, so the repo's benchmark builder now makes them too. The 50 tuned and cEDH decks whose
lists are lost are carried forward unchanged. Nothing anyone sees changes; this is what lets new precons join the
percentiles later.

## What users see

Nothing. Every percentile and tier placement is unchanged: checked for Spark from 0.0 to 10.0 and for every
reference row.

## How it works

- `pipelines/reference-corpus/benchmark-baselines.mjs` adds `REFERENCE_SCORES` and `REFERENCE_TIERS` to its
  output. The sample rows are the golden harness's five axis scores rounded to one decimal, in sample order,
  tier `p` for precons and `t` for curated decks. `NOT_IN_REFERENCE` holds the four Star Trek precons, which were
  never scored in. Then come the 30 tuned and 20 cEDH rows from the new input file `frozen-reference-rows.json`
  (copied from the committed rows 174–223). Shapes are checked before writing, and only files whose contents
  change are rewritten, so unchanged files keep their manifest dates.
- Evidence: all 174 sample rows match a committed row exactly. `REFERENCE_SCORES` was rewritten only because two
  rows (Multiverse Reforged, Odds and Ends) now sit in sample order; the set of (tier, scores) rows is identical.
  Percentiles and tier placement never depend on row order. `REFERENCE_TIERS` is byte-identical.
- `src/engine/reference.ts`: each row's Command Spark is now `computeSpark()` of its scores
  (`referenceSparks(ref)`), replacing the hand-kept `src/data/reference-spark.ts` table, which is deleted.
  Checked: all 224 values identical, and `computeSparkPercentile` gives the same result at every value from 0.0 to
  10.0. `computeSparkPercentile` now takes the reference set (its one caller,
  `src/services/reference-data.ts`, passes it), so new rows bring their Spark automatically.
- Data: `public/data/REFERENCE_SCORES.json` (row order) and its manifest entry, written by the builder. No
  Firestore changes.

## Testing

`benchmark-baselines.test.mjs` pins all five files to the builder's output from the golden fixtures, and checks
the reference rows' order, tiers and frozen tail. Golden snapshots are unchanged (`git diff --stat --
tests/golden` is empty). `npm run check` passes.

## Risks and rollback

None expected. If an engine change moves sample axis scores, the test fails: the sample rows can be refit, but
the frozen 50 can't be re-scored without new lists. Revert with `git revert <sha>`.

## Follow-ups

- The precon importer (036) adds new precons to the reference set along with Try a Deck.
- Whether to score the four Star Trek precons into the percentiles (remove them from `NOT_IN_REFERENCE`).

## Related

020, 034 (precon benchmarks).
