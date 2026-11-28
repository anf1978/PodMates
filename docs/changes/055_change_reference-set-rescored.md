# 055: Score the reference set's tuned and cEDH decks from their stored lists

Date: 2026-11-28

## Summary

Every percentile and "higher than X% of the tuned decks / cEDH lists" line compares a deck against the
PodMates reference set. Its 30 tuned and 20 cEDH rows were frozen in October because their decklists had been
lost. They are now scored by today's engine from the lists stored in 054, so they stay correct when the scoring
changes. That matters for the planned Monte Carlo opening-hand work on Speed and Consistency. The tier sizes
are unchanged (168 precons, 36 tuned, 20 cEDH) and most numbers barely move.

## What users see

- Percentiles of the whole reference set move by at most 2 points on any axis or Spark.
- Tier placements move only against the cEDH lists, mainly near the top: a Spark 9.0 deck now beats 55% of
  the cEDH lists (was 38%), a Spark 8.0 deck 3% (was 10%). Versatility 8.0 beats 55% of them (was 40%), and
  Disruption 9.0 beats 30% (was 20%). The cEDH tier's median Spark is 8.95 (was 9.2) and its lowest 8.0 (was
  7.2). Tuned placements move by a point at most.
- The Impact cards window now says the default list "was chosen from the October 2026 reference decks", since
  it was fitted on the old lists and is not re-fitted here.
- Scores, brackets, Spirit bands and the "could function at a cEDH level" note are unchanged for every deck.

## How it works

- `pipelines/reference-corpus/benchmark-baselines.mjs`: the reference set is the samples (as before), then
  one row per deck from `reference-decks.mjs` (new; reads `reference-decks.json` and `decks/` in manifest
  order, 30 tuned then 20 cEDH). `buildReferenceSet(rows, referenceRows)` / `buildBenchmarkFiles(rows,
referenceRows)` replace the frozen-rows argument, and the builder refuses anything but 30 + 20.
  `frozen-reference-rows.json` is deleted (it stays in git history).
- `public/data/REFERENCE_SCORES.json` regenerated with `--update-public-data --from-fixtures` (rows 174-223
  change; rows 0-173 are byte-identical; `REFERENCE_TIERS` is unchanged) and its manifest entry refreshed.
  The fingerprints and staples/mana-base baselines are unchanged.
- `tests/golden/generate-fixture.mjs` also pins the reference decks' cards and Spellbook rows and proves full-data
  parity for them; re-pinned with `--add public/data/cards.json`, which keeps the 7,621 original cards exactly
  as they were and appends 1,145 (Spellbook rows 3,397 → 6,392). Every golden snapshot is unchanged.
- Re-checked fits (comments only, constants unchanged): Spirit bands still put 34 of 36 tuned decks and all 20
  cEDH lists in Tuned, and no precon; "could function at a cEDH level" fires for 19 of 20 cEDH lists (not
  Etali), 11 of 36 tuned decks and 0 of 168 precons (`spark.ts`, `brackets.ts`).
- Comment and doc updates: `src/engine/reference.ts`, `src/engine/CLAUDE.md`, `src/data/impact-defaults.ts`,
  `pipelines/README.md`, `docs/overview.md`, `docs/architecture.md`; the explainers build their tier wording
  from the data (`referenceSetSummary`, `describeTierPlacement`), so their text needs no edit.
- No Firestore or other data changes.

## Testing

- `benchmark-baselines.test.mjs`: the committed files equal the builder's output from the pinned fixtures; the
  reference set is the samples then 30 `t` and 20 `c` rows equal to the reference decks' scores; every reference
  deck card is found in the fixtures; fewer than 50 reference decks is refused.
- The fixture-scored rows equal the same decks scored with the full card DB.
- `npm run check` (golden unchanged).
- On the live site: chart a strong deck and open the Spark explainer; the cEDH share in "it scores higher than
  …" reflects the new lists. Build Table's cEDH % column moves the same way.

## Risks and rollback

A deck's cEDH-tier placement can read noticeably different near Spark 8-9; that is the intended correction. If
it looks wrong, `git revert` this commit and push: that restores the frozen rows, the old fixtures and the
previous `REFERENCE_SCORES`.

## Follow-ups

- The default impact cards were fitted on the October cEDH lists. On today's lists Cabal Ritual, Misdirection,
  Demonic Consultation, Beseech the Mirror, Wishclaw Talisman, Vexing Bauble and Wheel of Fortune appear in
  fewer than 7 of 20, and Lotus Petal is in 7 of 30 tuned lists (the limit is 2). Re-fitting moves Power, so it
  is an `/engine-change` for the owner to decide.
- The Monte Carlo opening-hand research pass (054's follow-up), now on a fully re-scorable reference set.

## Related

`054` (the stored lists), `035` (reference-set builder), `034` (benchmark refit).
