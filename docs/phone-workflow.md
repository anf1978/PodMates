# Working on PodMates from a phone

The developer works only from a phone, through Claude Code cloud sessions in the Claude iOS app. Nobody reviews
changes and the session may not be able to run tests, so **GitHub does the testing**. A session pushes its own
branch: `ccr-<id>`, the branch a Claude cloud session starts on (or `claude/<topic>` elsewhere). If CI passes on it, the branch merges itself into `main`, CI runs again on `main`, and
the site deploys. Nobody taps anything ([ADR 0001](adr/0001-development-workflow.md)).

```
session: edit + change doc → push its ccr-<id> branch
GitHub:  CI on the branch ──red──→ nothing merges; the session reads the errors, fixes, pushes again
            │ green
            ▼
         Auto-merge: rebase onto main, push, delete the branch ──conflict──→ the session rebases, pushes again
            ▼
         full CI on main ──red──→ live site stays on the last good build; fix or revert at once
            │ green
            ▼
         Deploy Pages (the deploy gate checks CI again) → https://anf1978.github.io/PodMates/
```

A round trip takes about 10–15 minutes: CI on the branch (~5), CI on `main` (~5), deploy (~2).

## One-time setup (a human does this once)

1. **Give the Claude app access to the repo.** Claude app → Code → connect GitHub, then on GitHub configure the
   **Claude** GitHub app for `anf1978/PodMates` (github.com → Settings → Applications → Installed GitHub Apps →
   Claude → Configure → Repository access). Sessions push their `ccr-…` branches. For a change to
   `.github/workflows/` the app also needs GitHub's _Workflows_ permission. Don't add branch protection on `main`:
   Auto-merge pushes to it with the Actions token.
2. **Let Actions open pull requests** (only used for workflow-file changes): repo → Settings → Actions → General →
   Workflow permissions → tick **Allow GitHub Actions to create and approve pull requests**.
3. **Environment setup script (optional).** Claude app → Code → the environment's settings → **Setup script**:

   ```bash
   npm ci || echo "no local checks; CI tests everything"
   ```

   This lets a session run quick checks (lint, typecheck, one test file) before pushing. It's optional: CI runs
   everything anyway. Don't install Playwright browsers in the sandbox. Don't add Claude hooks: they were removed on
   purpose.

4. **Network access.** Keep the default ("trusted"). Sessions need `github.com` (git) and `api.github.com`
   (`node scripts/ci-status.mjs`), plus `registry.npmjs.org` if you use the setup script. Add them in the
   environment's network settings only if a session reports one blocked.
5. **Notifications for failures.** On github.com (the mobile browser works): avatar → Settings → Notifications →
   **Actions** → turn on, tick **Only notify for failed workflows**, deliver via GitHub. In GitHub Mobile: Profile →
   gear → Notifications → allow push notifications. GitHub notifies the account that triggered a run, so it may
   skip runs started by the Actions token. The session following its own change (below) is the main safety net.

These are unverified until the first session runs this way (R17). That session is also the phone trial.

## Start a session

1. Claude app → **Code** → pick the PodMates repository (and the environment from step 3) → new session.
2. Describe the change in plain words. The rules in `CLAUDE.md` take care of the rest: start from the latest
   `main`, write a change doc, push the session's branch, follow it until it's deployed. **Every push that passes CI
   goes live**, so the session only pushes finished work.
3. Want to look before it ships? Say "don't ship it yet". The session marks its commit `[wip]`, so CI runs but
   nothing merges. When you're happy, say "ship it" (it pushes a commit without `[wip]`), or tap **Merge** on a PR.
4. Keep the session open until it says the change is deployed. If you close it early, the merge and deploy still
   happen; only fixing a red CI needs a session.

## What "done" looks like

The session's last message says:

1. The change doc it wrote (`docs/changes/NNN_<type>_<slug>.md`, [convention](changes/README.md)) and any living
   docs it updated.
2. The branch it pushed, and `node scripts/ci-status.mjs <branch>` ending in **"Done: merged, CI green on
   main and deployed"**.
3. The commit ids now on `main` (needed for a revert).

Then reload <https://anf1978.github.io/PodMates/>. A tab that was already open shows a **New version available /
Reload** banner.

## When something is red

- **Where to look:** GitHub Mobile → repo `PodMates` → **Actions**, or the mobile browser at
  <https://github.com/anf1978/PodMates/actions>. Tap the red run → the failed job (or **Summary** in the
  browser). The summary lists each step's result, the failing test names, the first error lines and, if engine
  snapshots changed, which ones. The same lines appear as **Annotations**.
- **CI red on the session's branch:** nothing merged and nothing deployed. Tell the session "CI failed, fix it" (it can
  read the errors itself with `node scripts/ci-status.mjs`), or paste the summary into a new session.
- **Auto-merge red:** usually a conflict with something merged in the meantime. Ask the session to rebase the branch
  on `main` and push again.
- **CI red on `main`** (rare: two changes merged close together and clash): the live site stays on the last good
  build, and weekly data refreshes still deploy that build. Ask a session to fix it on a new branch, or to revert.
  A common cause is two sessions picking the same change-doc number (`tests/change-docs.test.ts` "never reuses a
  number"): the later one renames its doc to a number that is free on `origin/main` **and** not already used by
  another session's pushed branch, then pushes again.
- **`ci-status.mjs` says "API rate limit exceeded"** (HTTP 403 with a stack trace): GitHub allows about 60 calls an
  hour without a login, shared by everything on that network. Wait for the limit to reset (up to an hour), or use
  `gh run list` if `gh` is logged in. Polling every 3–5 minutes, as `CLAUDE.md` says, stays under it.
- **A PR is waiting** for a change to `.github/workflows/`: if its CI is green, tap **Merge** in GitHub Mobile.

## Rolling back

- **Lasting fix:** ask a session to "revert commit `<id>`". The revert goes through the session's branch like any
  change.
- **Instant, temporary:** in the mobile browser (GitHub Mobile may not offer workflow inputs): Actions → **Deploy
  Pages** → **Run workflow** → branch `main`, **ref** = the last good commit id (from the commit list or an older
  Deploy Pages summary), tick **deploy** → Run. It refuses a commit whose CI never passed. The next merge or weekly
  data refresh deploys `main` again, so follow up with the revert.

## New precons for Try a Deck

After each Monday card-database rebuild, the **Precon Import** workflow looks for new official Commander precons. If
it finds some, it opens a pull request titled "Add N new precons to Try a Deck" and asks you to review it, so
GitHub Mobile notifies you. Check the suggested archetype, style and tagline in its description; ask a session to
change them on the `wip/precon-import` branch if they read wrong. Once its CI is green, tap **Merge**. The new decks
appear in Try a Deck and signed-in players get a "New in Try a Deck" notice. If you leave it, next week's run
replaces the pull request with a fresh one. Decks whose cards aren't in the card database yet are listed as
"Waiting" and come back automatically.

## Dependabot

Dependabot opens at most one PR per week per ecosystem (npm, GitHub Actions), with minor and patch updates only. If
its CI is green, tap **Merge** in GitHub Mobile. The merge runs CI on `main` and deploys through the gate like any
other change. If CI is red, ask a session to look at the PR. Major upgrades are ignored; ask a session when you want
one ("upgrade Vite to the next major"). It gets a change doc.

## Updating snapshots without a terminal

Only for an intended engine change whose change doc explains why scores move. Usually the session runs `npm run
golden:update` itself and pushes the result. If it can't, it asks you to run, in the mobile browser: Actions →
**Update Snapshots** → Run workflow on the session's `ccr-…` branch, with **reason** = what changed and the change
doc number. It regenerates golden and Playwright snapshots on Linux, commits them to that branch, runs CI and starts
Auto-merge. Run on `main`, it uses a new `claude/snapshots-<run>` branch.

## Things that used to need a desktop

| Task                                 | From a phone                                                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run the checks or e2e                | Not needed: CI runs them on every pushed branch                                                                                                                      |
| Read a Playwright report             | Read the run's Summary or `node scripts/ci-status.mjs`; the zipped report is a fallback for a desktop                                                                |
| Merge a PR (`gh pr merge`)           | Tap **Merge** in GitHub Mobile; session branches merge themselves                                                                                                    |
| `gh stack merge` / `gh stack link`   | Not needed any more: the refactor stack is finished                                                                                                                  |
| Deploy, rebuild data, Pages settings | Mobile browser: Actions → workflow → Run workflow; Settings → Pages                                                                                                  |
| `firebase deploy` (rules, indexes)   | Never done from sessions or the repo; rules stay unchanged ([firebase/CLAUDE.md](../firebase/CLAUDE.md)). If ever decided, paste the rules into the Firebase console |

How the workflows decide what merges and deploys: [deploy.md](deploy.md).
