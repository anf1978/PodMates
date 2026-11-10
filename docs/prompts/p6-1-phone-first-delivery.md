# Session p6-1 — Phone-first delivery loop

Follow the session rules in `docs/prompts/00-README.md`. Context: `docs/refactor-plan.md` §4.6, §5.3, decisions D1
and D4, and the workflows from p1-4 / p5-2.

## Why

The main developer works **only from a smartphone**: Claude Code cloud sessions in the Claude iOS app, and review
and merge in the GitHub iOS app or mobile browser. He has no terminal. The cloud sandbox can run `npm run check`,
but it may not be able to run everything (Playwright browsers, the Firebase emulator). He also can't open a dev
server, read a zipped Playwright report, or run `gh` himself. The plan assumes a desktop in several places. This
session makes the loop work end to end from a phone:

> Claude cloud session edits → opens PR → CI runs → **preview URL** to try on the phone → merge (tap, or auto-merge
> when green) → deploy runs **only if CI passed** → rollback is one tap.

**Pushing straight to `main` is rejected on purpose.** With no PR, CI would only run after the broken code was
already on `main` and deploying. Keep branch protection (required checks, no direct pushes) and use auto-merge
instead. It has the same "no extra steps" feel and keeps the safety net.

## Task

1. **Gate deploy on CI.** Today `deploy.yml` runs on every push to `main` without checking CI. Make it deploy only
   after `ci.yml` succeeds on that commit, either with `workflow_run` (`conclusion == 'success'`, `head_branch ==
   'main'`, and checking out `workflow_run.head_sha`) or by moving deploy into `ci.yml` as a job that `needs` the
   test jobs. Keep the data-workflow trigger from p1-4 / D5 working, and keep `workflow_dispatch` with an optional
   `ref` input so you can redeploy an older commit (rollback) from the mobile browser's Actions tab.
2. **Auto-merge.**
   - Document the human steps in `docs/phone-workflow.md`: Settings → General → "Allow auto-merge", plus required
     status checks in branch protection.
   - Add a `CLAUDE.md` rule: after opening a PR, run `gh pr merge --auto --squash <PR>` **only if the user said to
     ship it**. Otherwise leave the PR for a tap-merge in the GitHub app.
   - Check that `gh` works in the cloud sandbox. If it doesn't, document the GitHub-app path only.
3. **Cloud-session bootstrap.**
   - In `.claude/settings.json`, add a `SessionStart` hook that runs only when `CLAUDE_CODE_REMOTE=true`. It runs
     `npm ci`, then tries `npx playwright install chromium`. If that fails, it prints one line: "e2e runs in CI
     only".
   - Make sure the `Stop` hook runs only the fast `npm run check`, not e2e or the emulator.
   - If the sandbox's default network allowlist blocks something it needs, list the domains in
     `docs/phone-workflow.md` as a human step (Claude environment settings). Don't work around it.
4. **CI output a phone can read.**
   - Each job writes a short Markdown summary to `$GITHUB_STEP_SUMMARY`: failing test names, the first error lines,
     and the golden diff stats.
   - Post or update **one** sticky PR comment with the same summary (and the preview URL, see 5).
   - Goal: the friend can read why it failed in the GitHub app, or paste it into Claude, without downloading
     artifacts. Mention Claude's PR auto-fix (cloud session CI bar) in the doc as an option.
5. **PR preview deploys.** GitHub Pages can't host one preview per PR, so pick a host and record it as
   `docs/adr/0008-pr-previews.md`. Recommended: **Firebase Hosting preview channels**
   (`FirebaseExtended/action-hosting-deploy`). It's the same Firebase project, comments the URL on the PR, and
   channels expire. The alternative is Cloudflare Pages direct upload.
   - Production stays on GitHub Pages (D4) unless the humans decide otherwise.
   - Check whether Firebase Auth sign-in works on the preview domain. If preview domains must be added to
     Authorized domains, document that, or that sign-in is unavailable on previews.
   - The secret (service account / API token) is a human step. Name it in the doc and never commit it.
   - Skip the preview job, without failing, when the secret is missing.
6. **Snapshot updates without a terminal.** Add a `workflow_dispatch` workflow `update-snapshots.yml` with a `branch`
   input. It runs `npm run golden:update` and Playwright `--update-snapshots` on Linux and commits the result to that
   branch.
   - Pushes made with `GITHUB_TOKEN` don't re-trigger CI, so either dispatch `ci.yml` for that branch afterwards or
     document the "re-run checks" tap.
   - Refuse to run against `main`.
   - The `/engine-change` rule still applies: the PR must explain the golden diff.
7. **`docs/phone-workflow.md`** (short, step by step with screenshots-in-words): start a session in the Claude app,
   what "done" looks like, reading CI, opening the preview, merging / auto-merge, rolling back. Rollback options:
   the "Revert" button on the merged PR, or `deploy.yml` → Run workflow with an older `ref`. Link it from `CLAUDE.md`
   and `README.md`.
8. Review `00-README.md` "Human-only tasks" and `docs/deploy.md` for steps that need a desktop CLI (`gh stack merge`,
   `gh stack link`, `firebase` CLI). Add a phone equivalent for each, or note that a Claude cloud session can run
   it on the human's behalf.

## Out of scope

Changing the production host, enabling repo settings and branch protection, or creating secrets (human tasks).
Tighten the workflow security pinning from p5-2, but don't loosen it.

## Done when

- On this PR: CI is green, the step summary and sticky comment show up, and a preview URL is posted (or the PR
  explains the missing secret).
- You've shown that a failing check stops `deploy.yml`, with a dry run or a clear explanation of the trigger logic.
- `docs/phone-workflow.md` exists and has been followed once from the Claude iOS app, or the PR lists what still
  needs a human to try it on a phone.
