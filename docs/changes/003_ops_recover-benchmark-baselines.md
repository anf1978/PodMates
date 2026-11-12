# 003: Rebuild the staples and mana-base baselines from recovered scripts

Date: 2026-11-12

## Summary

Two of the data files behind the Deck Chart, the "staples check" and the "mana base" comparison, could not
be rebuilt because the scripts that made them were lost. The owner recovered part of the original Nov 3
chat session. From it, the repo now has a builder that recreates both files exactly, plus a test that
proves it. The recovered scripts are kept word for word as a record. Nothing on the site changes.

## What users see

Nothing. The data files are unchanged.

## How it works

- `pipelines/reference-corpus/benchmark-baselines.mjs`: `deckFeatures()` analyses each Try-a-Deck sample
  with the engine (`analyzeDeck`, `computeManaBaseBenchmark`, the same commander-card lookup as
  `src/features/deck-chart/run-analysis.ts`). `buildBaselines()` is a port of the recovered Python
  aggregation (inline script 7): per-archetype medians of the 12 staples counts, and mana-base medians by
  exact colour identity and by colour count. `median()` and `roundHalfEven3()` match Python's
  `statistics.median` and `round(x, 3)`, including rounding the float's exact binary value (0.6085 → 0.609).
  The CLI writes to a given folder, never `public/data/`.
- The Nov 3 fit used 174 decks. Searching every combination of 2026 sample decks found exactly one set of
  four that reproduces both files when left out: the Star Trek precons Federation Fleet, We Are the Borg,
  Klingon Fury and Landing Party (also absent from `PRECON_FINGERPRINTS`). They are listed in
  `EXCLUDED_FROM_NOV_3_FIT`. `--all-samples` includes them, which would be a new fit.
- `pipelines/reference-corpus/recovered/`: `inline-python-patches-and-calcs.txt`, `pw170.cjs`, `txt.py` and
  `pwja.cjs`, copied unchanged, with a README saying what each did. `eslint.config.js` ignores the folder.
- Also checked, not changed: today's engine reproduces 123 of the 174 committed `PRECON_FINGERPRINTS` exactly.
  The other 51 differ slightly, so the fingerprint builder is not considered recovered.
- No data changes. No Firestore, workflow or app-source changes.

## Testing

`pipelines/reference-corpus/benchmark-baselines.test.mjs` (part of `npm run check`) rebuilds both files from
the pinned golden fixtures and requires byte equality with `public/data/STAPLES_BASELINE.json` and
`MANABASE_BASELINE.json`, plus unit checks of the Python-compatible median and rounding. The CLI was also run
on the full committed card DB and the output compared with `cmp`: identical.

## Risks and rollback

Low: new files, one lint ignore and docs. If a future engine change makes the test fail, the baselines have
drifted from the engine. Refitting moves the Deck Chart's staples and mana-base checks, so it goes through
`/engine-change` rather than a quiet regenerate. Undo with `git revert <sha>`.

## Follow-ups

- Still unrecovered: `know-build.cjs` (`KNOW_JSON`), `impact-cands.cjs` (`IMPACT_CANDS`) and the builders of
  `REFERENCE_SCORES`, `REFERENCE_TIERS` and `PRECON_FINGERPRINTS` (Oct 12, ~Oct 21–22 and Nov 1 chats).
- Decide whether to refit the baselines with all 178 samples (an intentional engine change).

## Related

001, 002. `pipelines/README.md` ("Benchmark baselines").
