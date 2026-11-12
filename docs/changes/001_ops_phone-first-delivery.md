# 001: Phone-first delivery: push to main, deploy only green commits

Date: 2026-11-12

## Summary

PodMates is now worked on from a phone: a Claude session makes a change, checks it, writes a doc like this one and
pushes it straight to `main`, with no pull request. To keep that safe, the live site only ever gets a version whose
automated tests passed; a broken change stays off the site until it is fixed or undone, and undoing is one tap. Test
failures are summarised on a page a phone can read. From now on every change comes with a numbered doc in
`docs/changes/`, so there is always a written record of what changed and why.

## What users see

Nothing on the site. For the developer: CI runs show a readable Summary page, a failing commit no longer deploys,
and the Actions tab has a rollback (Deploy Pages → `ref`) and an **Update Snapshots** button.

## How it works

- `.github/workflows/deploy.yml` lost its push trigger. It starts when `CI` or a weekly rebuild finishes, or by hand.
  Its first job runs `scripts/resolve-deploy-commit.mjs`, which asks the GitHub API for main's history and CI results
  and picks the commit: after CI, that commit only if it is the newest green one on `main`; after a data rebuild, the
  newest green commit even if `main`'s head is red; by hand, an optional `ref` that must be on `main` and green to be
  published (rollback). Build and deploy jobs then use that commit. Table in `docs/deploy.md`.
- `.github/workflows/ci.yml`: runs on `main` are no longer cancelled by newer pushes (each commit gets a verdict);
  each job pipes its output to `logs/` and `scripts/ci-summary.mjs` writes failing tests, first errors and golden
  diff stats to the Summary page plus `::error` annotations. Checkouts no longer keep credentials.
- `.github/workflows/update-snapshots.yml`: manual, required `reason`; runs `golden:update` and Playwright
  `--update-snapshots`, commits to the branch it ran on, pushes and dispatches `CI`.
- `.github/dependabot.yml`: one grouped weekly PR per ecosystem, minor/patch only, majors ignored.
- Docs: `CLAUDE.md` Rule 1 (direct-push checklist) and the "Docs ship with every change" table;
  `docs/phone-workflow.md` (new); `docs/changes/README.md` (this convention); ADR 0001 corrected (the data bots
  no longer push to `main`); ADR 0008 (no PR previews); `docs/prompts/00-README.md` marks the stacked-PR workflow
  historical and gives phone routes for human tasks; `/new-feature`, `/engine-change` and `/check` write or check
  the change doc. `tests/change-docs.test.ts` enforces doc names, unique numbers and headings.
- No data changes: no Firestore paths, datasets or local storage keys touched.

## Testing

- `tests/deploy-gate.test.ts` covers every trigger: failed CI, late older run, red head with a data refresh,
  rollback allowed over a newer commit, rollback refused for a commit without green CI or not on `main`, build-only
  runs, manual runs from other branches. `tests/ci-summary.test.ts` parses vitest, Playwright, tsc and ESLint output.
- Dry run of the gate against the real repository (read-only API): a data refresh and CI on the head both chose
  `5edae89`; a late CI run for `c1065df` was skipped; a rollback to `8d067c6` was allowed; `c1065df` (a PR-branch
  commit) was refused; with `main`'s head simulated as the red `26bfc1b` (#43), a data refresh chose the newest green
  `1d397f2` and the failed CI run deployed nothing.
- On the live site after merging: push a commit and check Actions shows CI, then Deploy Pages with "Deploy gate:
  deploying <sha>" on its Summary page.

## Risks and rollback

- If the gate script or the API misbehaves, Deploy Pages fails and the site stays on the last good build; nothing
  wrong is published. Revert the workflow commit to restore push-triggered deploys.
- Deploys now wait for CI (about 4–5 minutes) instead of starting on push.
- Unverified until the first direct-push session (R17): pushing to `main` from the Claude cloud sandbox, `gh` in the
  sandbox, failed-run notifications, and whether a CI run dispatched by Update Snapshots starts Deploy Pages
  (fallback: run Deploy Pages by hand with **deploy** ticked).

## Follow-ups

- R17 (`docs/prompts/p6-2-feature-docs.md`) backfills a change doc per feature and adds the "every feature has a doc"
  check; it is also the phone trial for the setup in `docs/phone-workflow.md`.
- Existing Dependabot PRs #33–#42 predate the grouping; leave them for a human to merge or close.

## Related

ADR 0001 (direct pushes), ADR 0004 (GitHub Pages via Actions), ADR 0005 (data branch), ADR 0008 (no PR previews).
