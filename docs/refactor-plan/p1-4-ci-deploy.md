# Session p1-4 — CI and deploy workflows

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` task 1.4, §4.6, decision
D4, and the "Deploy switch" risk in §8.

## Task

1. `.github/workflows/ci.yml` on `pull_request` (no `branches` filter, so stacked PRs whose base isn't `main` get
   CI too) and `push` to `main`: Node 22, `npm ci`, `npm run check`, then
   install Playwright Chromium and run `npm run e2e`; upload the Playwright report on failure. Cache npm. Pin actions
   to major versions (full SHA pinning comes in p5-2).
2. `.github/workflows/deploy.yml`: on push to `main` (and `workflow_dispatch`): build with Vite and deploy `dist/` with
   `actions/upload-pages-artifact` + `actions/deploy-pages`. Use the right `permissions` and a `concurrency` group.
3. The weekly data workflows commit to `main`, so they must also trigger a deploy. Confirm that their pushes trigger
   `deploy.yml`; pushes made with `GITHUB_TOKEN` do **not** trigger other workflows, so add an explicit
   `workflow_dispatch`/`workflow_call` step or another documented fix.
4. Confirm `dist/` contains everything the live site serves today (icons, manifest, `apple-touch-icon.png`, any other
   file referenced by URL) by diffing against the repo root files the live site uses.
5. Write `docs/deploy.md`: how deploys work, how to switch Pages to "GitHub Actions" (a human step) and how to roll
   back (switch the source back to "Deploy from branch").

## Out of scope

Actually switching the Pages source or setting branch protection (human tasks, see README).

## Done when

- CI runs green on this PR itself.
- `deploy.yml` has been run successfully on a fork or via `workflow_dispatch` against a non-production environment,
  or the PR explains exactly what was verified and what wasn't.
