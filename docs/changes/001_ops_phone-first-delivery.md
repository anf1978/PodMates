# 001: Phone-first delivery: branches that test, merge and deploy themselves

Date: 2026-11-12

## Summary

PodMates is now worked on from a phone. A Claude session makes a change, writes a doc like this one and pushes it
to its own branch. GitHub then runs all the tests, so neither the phone nor the session has to. If they pass, the
change merges itself into the main code and goes live; if not, nothing changes and the session fixes it. The live
site only ever gets a version whose tests passed, and undoing a change is one tap. Test failures are summarised on
a page a phone can read. Every change now comes with a numbered doc in `docs/changes/`, so there is always a written
record of what changed and why.

## What users see

Nothing on the site. For the developer: CI runs show a readable Summary page, a failing change never merges or
deploys, `claude/` branches merge themselves, and the Actions tab has a rollback (Deploy Pages → `ref`) and an
**Update Snapshots** button.

## How it works

- **Deploy gate** (PR #69, merged): `.github/workflows/deploy.yml` has no push trigger. Its first job runs
  `scripts/resolve-deploy-commit.mjs`, which uses the GitHub API to pick the newest commit on `main` whose CI passed:
  after CI (only if that commit is the newest green one), after a data rebuild (even when `main`'s head is red), or
  by hand with an optional `ref` (rollback; must be on `main` and green). Table in `docs/deploy.md`.
- **CI** (`ci.yml`) runs on `main`, `claude/**` and `wip/**` pushes and on PRs. Every `main` commit gets its own
  verdict. `scripts/ci-summary.mjs` writes failing tests, first errors and golden diff stats to the Summary page,
  plus `::error` annotations.
- **Auto-merge** (`auto-merge.yml`, `scripts/auto-merge.sh`, `scripts/dispatch-and-watch.sh`): when CI passes on a
  `claude/` branch's latest commit, it rebases the branch onto `main`, pushes, deletes the branch, runs CI on
  `main`, then starts Deploy Pages. Conflicts and red CI never merge. Workflow-file changes get a PR for a human.
  `wip/` branches never merge themselves.
- **`scripts/ci-status.mjs`**: a session follows its branch to the deploy with the public API (no `gh` login),
  including failing test names and the next step.
- **`update-snapshots.yml`**: manual, required `reason`. It updates golden and Playwright snapshots on a branch and
  ships them through Auto-merge.
- **Dependabot**: one grouped weekly PR per ecosystem, minor/patch only.
- **Docs**: `CLAUDE.md` Rule 1 (the branch workflow) and the "Docs ship with every change" table;
  `docs/phone-workflow.md`; `docs/changes/README.md` (this convention) with `tests/change-docs.test.ts`; ADR 0001
  (self-merging branches; the data bots don't touch `main`); ADR 0008 (no PR previews); `docs/deploy.md`;
  `docs/refactor-plan/00-README.md` (stacked PRs historical, phone routes for human tasks); `/new-feature`,
  `/engine-change` and `/check` write or check the change doc.
- No data changes: no Firestore paths, datasets or local storage keys touched.

## Testing

- `tests/deploy-gate.test.ts`: every gate trigger. `tests/ci-summary.test.ts`: vitest, Playwright, tsc and ESLint
  output. `tests/auto-merge.test.ts`: the merge script against throwaway git repositories (fast-forward, rebase onto
  a newer `main`, red CI, branch moved after CI, conflict, workflow files, non-`claude/` branches).
  `tests/ci-status.test.ts`: next-step logic.
- Deploy gate against the real repository: dry runs chose the right commit for each trigger, including a data
  refresh with `main`'s head simulated as the red `26bfc1b`, which picked the newest green `1d397f2`. The first real
  run after merging #69 deployed `5c85862` ("CI passed on main").
- On the live site: the next session's first `claude/` branch should merge, run CI on `main` and deploy;
  `node scripts/ci-status.mjs <branch>` should end in "Done".

## Risks and rollback

- If the gate or Auto-merge misbehaves, nothing merges or deploys and the site stays on the last good build. Revert
  the workflow commit (through a PR, since it touches workflow files).
- A change takes 10–15 minutes from push to live (CI twice, then deploy).
- Two branches merged close together can clash on `main`. CI on `main` catches it and the gate blocks the deploy;
  fix forward or revert.
- Unverified until R17: pushing branches from the Claude cloud sandbox, `api.github.com` access for the status
  script, and failure notifications for runs started by the Actions token.

## Follow-ups

- R17 (`docs/refactor-plan/p6-2-feature-docs.md`) backfills a change doc per feature and is the phone trial for
  `docs/phone-workflow.md`.
- Existing Dependabot PRs #33–#42 predate the grouping (all major bumps); a human merges or closes them.

## Related

ADR 0001 (self-merging branches), ADR 0004 (GitHub Pages via Actions), ADR 0005 (data branch), ADR 0008 (no PR
previews).

Later changes: 002, 003, 027
