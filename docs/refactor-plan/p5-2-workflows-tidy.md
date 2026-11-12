# Session p5-2 — Workflow tidy-up

Follow the session rules in `docs/prompts/00-README.md`. Context: `docs/refactor-plan.md` Phase 5, §4.3
(`.github/actions/scryfall-bulk/`). Requires p5-1.

## Task

1. `.github/actions/scryfall-bulk/action.yml` composite action: download a Scryfall bulk file by type (with the
   project User-Agent, retries, gzip handling, cache), replacing the copy-pasted download steps. Use it everywhere.
2. Consolidate the weekly data jobs into `data-weekly.yml` (card DB + tags, then win-rates) if that reduces
   duplication. Keep the same schedule times and the same outputs.
3. Move `scryfall-tags.yml`'s inlined script into `pipelines/` (or remove the workflow if `fetch-function-tags`
   covers it).
4. Archive one-off probes (`pricescry-probe.yml`, `pricescry-tcgcsv-probe.yml`, `spellbook-snapshot-probe.yml` if
   superseded, `pricescry-backfill.yml` run-once): delete them and record in `pipelines/README.md` what they were and
   the commit they lived in.
5. Pin all third-party actions to full commit SHAs with a version comment; least-privilege `permissions:` per job;
   `concurrency` on data jobs. Add Dependabot for `github-actions` and `npm`.

## Done when

`actionlint` clean; every remaining workflow run once via `workflow_dispatch` (links in PR) or explained.
