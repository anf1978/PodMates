# Session p5-3 — `src/shared`: one copy of code used by app and pipelines

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` Phase 5 and §4.3
(`src/shared/`). Requires p5-1 and the `pricescry` run of p3-5.

## Task

1. Find every "KEEP IN SYNC" pair (grep `KEEP IN SYNC` in `pipelines/` and `src/`). Known ones: `nameKey()`,
   `fnv1a()`, `shardOf()` (from `pricescry-lib.mjs`) and `psPlanTrade` (from `pricescry-study.mjs`).
2. Move one canonical, typed implementation of each into `src/shared/` (no DOM, no Node-only APIs). Import it from the
   app and from the pipelines; pipelines run TS via `tsx` or a small build step, so choose one and document it.
3. Delete the duplicate copies, and any test that only compared the two copies. Replace it with a unit test of the
   shared function, with fixed vectors taken from the current outputs (shard numbers for known names must not change,
   or existing `pricescry-data` shards would become unreachable).
4. Lint boundary: `src/shared` imports nothing from other `src/*` folders.

## Done when

`npm run check` + `npm run e2e` green; the daily PriceScry workflow runs successfully via `workflow_dispatch` on this
branch, and the app reads its output (PriceScry lookup works on a preview build).
