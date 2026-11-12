# Session p5-1 — Pipelines: `.github/scripts` → `pipelines/` with tests

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` Phase 5, §4.3, §7;
`docs/overview.md` §3.6. Can run in parallel with Phase 3 (after p2-2).

## Task

1. Move the scripts with `git mv` (keep history) into `pipelines/`:
   - `lib/` for shared helpers (HTTP with User-Agent + polite delays/retries, gzip, file writing, manifest updating);
   - `card-db/` (`build-card-db`, `fetch-function-tags`), `winrates/`, `spellbook/`, `pricescry/` (all `pricescry-*`),
     plus `knowledge/` and `reference-corpus/` for the recovered `know-build`, `impact-cands` and corpus scripts if
     they are in the repo.
2. Update every workflow path. Keep scripts as `.mjs` unless converting is trivial; type-check them with JSDoc +
   `checkJs` in a `pipelines/tsconfig.json`.
3. Tests (Vitest, in `npm run check`):
   - port `pricescry-risers-selftest.mjs` and `pricescry-study-selftest.mjs` to Vitest, then delete the self-test
     scripts;
   - fixture tests for the card-DB builder, **including gzip input** (it used to fail silently there) and a
     malformed-input case that must throw;
   - fixture test for the win-rate builder's output shape.
4. `pipelines/README.md` (one section per pipeline: inputs, outputs, schedule, secrets by name) and
   `pipelines/CLAUDE.md` (polite-traffic rules, never write into `src/`, output only to data files).

## Done when

`npm run check` green; each moved workflow runs successfully via `workflow_dispatch` on this branch (run links in the
PR) or the PR explains why one couldn't be run.
