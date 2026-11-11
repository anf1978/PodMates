# Session p6-1 — Phone-first delivery loop

Follow the session rules in `docs/prompts/00-README.md`. Context: `docs/refactor-plan.md` §4.6, §5.3, decisions D1
and D4, and the workflows from p1-4 / p5-2.

## Why

The main developer works **only from a smartphone**, using Claude Code cloud sessions in the Claude iOS app. It's a
one-developer site, so pull requests are overhead he doesn't want. He has no terminal. The cloud sandbox can run
`npm run check`, but it may not be able to run everything (Playwright browsers, the Firebase emulator). He also
can't open a dev server, read a zipped Playwright report, or run `gh` himself. The plan assumes a desktop in several
places. This session makes the loop work end to end from a phone, with **no PRs and no new accounts or secrets**:

> Claude cloud session edits → runs `npm run check` → **commits and pushes straight to `main`** → CI runs on `main`
> → deploy runs **only if CI passed** (otherwise production stays on the last good build) → rollback is one tap.

**Pushing to `main` is the decided workflow** (ADR 0001). The safety net is the deploy gate: a broken push can land
on `main`, but it never reaches the live site, and the next push (or a revert) fixes it. Git history stays intact.
Don't add branch protection that blocks direct pushes. It would also block the weekly data bots.

## Task

1. **Gate deploy on CI.** Today `deploy.yml` runs on every push to `main` without checking CI. Make it deploy only
   after `ci.yml` succeeds on that commit, either with `workflow_run` (`conclusion == 'success'`, `head_branch ==
   'main'`, and checking out `workflow_run.head_sha`) or by moving deploy into `ci.yml` as a job that `needs` the
   test jobs. Keep the data-workflow trigger from p1-4 / D5 working, and keep `workflow_dispatch` with an optional
   `ref` input so you can redeploy an older commit (rollback) from the mobile browser's Actions tab. Make sure an
   older successful CI run finishing late can't deploy over a newer one (deploy `main`'s current head only if
   that commit's CI passed, or use a `concurrency` group that keeps only the latest).
2. **Direct-push session rules.** Replace the PR rule in `CLAUDE.md` with:
   - Run `npm run check` before every push. Never push with it red.
   - Commit to `main` and push. If the push is rejected (a data bot or another session pushed first), run
     `git pull --rebase` and push again. Never force-push `main`.
   - One logical change per commit, with a clear message, so a bad change is one `git revert` away.
   - After pushing, check that CI went green on that commit (with `gh run watch` if `gh` works in the sandbox).
     If it went red, fix it in a follow-up commit right away, or revert.
   - Branches and PRs are still fine for big or risky work the user wants to look at first, but they're optional.
   Check that pushing to `main` works from the cloud sandbox. If the Claude GitHub app's permissions block it,
   document the human step (repo access for the Claude app) in `docs/phone-workflow.md`.
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
   - When CI fails on `main`, state in `docs/phone-workflow.md` exactly where to tap to see why (repo → Actions →
     the red run → Summary).
   - Goal: the friend can read why it failed on his phone, or paste it into Claude, without downloading artifacts.
     Mention that the Claude session can read the failure itself with `gh run view --log-failed` if `gh` works.
5. **No PR previews.** Don't add a preview host. Previews would need a new hosting setup, a service-account secret,
   and Firebase Auth authorized domains for each preview (no wildcards), which is too much for a phone-only
   one-developer site. Record this in `docs/adr/0008-no-pr-previews.md`: try changes on the live site after the
   CI-gated deploy, and roll back with one tap if needed. Reconsider only if the humans ask for previews.
6. **Snapshot updates without a terminal.** Add a `workflow_dispatch` workflow `update-snapshots.yml` (default ref
   `main`). It runs `npm run golden:update` and Playwright `--update-snapshots` on Linux and commits the result to
   the ref it ran on.
   - Pushes made with `GITHUB_TOKEN` don't trigger other workflows, so dispatch `ci.yml` for that ref afterwards
     (the deploy gate then sees a green CI on the new commit).
   - The `/engine-change` rule still applies: the commit that changes engine behaviour must say why the golden
     diff is expected.
7. **`docs/phone-workflow.md`** (short, step by step with screenshots-in-words): start a session in the Claude app,
   what "done" looks like (check green, pushed, CI green, deployed), reading a red CI run, rolling back. Rollback
   options: ask Claude to `git revert` the bad commit and push, or `deploy.yml` → Run workflow with an older `ref`.
   Link it from `CLAUDE.md` and `README.md`.
8. Review `00-README.md` "Human-only tasks" and `docs/deploy.md` for steps that need a desktop CLI (`gh stack merge`,
   `gh stack link`, `firebase` CLI). Add a phone equivalent for each, or note that a Claude cloud session can run
   it on the human's behalf. The stacked-PR refactor workflow is finished by the time this lands; mark it as
   historical in `00-README.md` so future sessions follow the direct-push rules instead.

## Out of scope

Changing the production host, adding branch protection, PR previews, or creating secrets.
Tighten the workflow security pinning from p5-2, but don't loosen it.

## Done when

- CI is green on this PR (the last refactor PR still goes through the stack), and the step summary shows up.
- You've shown that a failing check stops `deploy.yml`, with a dry run or a clear explanation of the trigger logic.
- `docs/phone-workflow.md` exists and has been followed once from the Claude iOS app, or the PR lists what still
  needs a human to try it on a phone.
