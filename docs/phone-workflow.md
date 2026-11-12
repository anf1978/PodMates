# Working on PodMates from a phone

The developer works only from a phone, through Claude Code cloud sessions in the Claude iOS app. There are no pull
requests by default: a session checks its work, writes a change doc and **pushes straight to `main`**
([ADR 0001](adr/0001-development-workflow.md)). The safety net is the deploy gate: a commit only reaches the live
site after CI passes on it, so a broken push can land on `main` but never goes live.

```
Claude session edits → npm run check → change doc → commit + push to main
  → CI runs on main → green: Deploy Pages publishes it · red: the live site stays on the last good build
```

## One-time setup (a human does this once)

1. **Give the Claude app access to the repo.** Claude app → Code → connect GitHub, then on GitHub install or
   configure the **Claude** GitHub app for `anf1978/PodMates` (github.com → Settings → Applications → Installed
   GitHub Apps → Claude → Configure → Repository access). It needs to push to `main`, including files under
   `.github/workflows/` (GitHub requires the app's _Workflows_ permission for those). There is no branch protection
   that blocks pushes; keep it that way.
2. **Environment setup script.** Claude app → Code → the environment's settings (the environment name above the
   prompt → settings) → **Setup script**, paste:

   ```bash
   npm ci
   npx playwright install chromium || echo "e2e runs in CI only"
   ```

   The sandbox needs Node 22.18 or newer; if `node -v` in a session says older, tell the session to say so. Don't
   add Claude hooks: they were removed on purpose.

3. **Network allowlist.** Keep the default ("trusted") network access. If a session reports a blocked download,
   add only what it needs in the same environment settings → Network access → custom allowlist:
   - `registry.npmjs.org` (`npm ci`), `github.com`, `api.github.com`, `objects.githubusercontent.com` (git, `gh`)
   - `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`, `playwright.azureedge.net` (Chromium for e2e)
   - The Firestore rules tests also need Java 21 and the emulator download (`firebase-public.storage.googleapis.com`);
     they normally run in CI only, so you don't need to allow these.
4. **Get a notification when CI fails.** On github.com (the mobile browser works): avatar → Settings →
   Notifications → **Actions** → enable notifications, tick **Only notify for failed workflows**, and choose
   GitHub (which includes GitHub Mobile). In GitHub Mobile: Profile → gear → Notifications → allow push
   notifications. GitHub notifies the account that triggered a run; if a session's push doesn't produce a
   notification, open the Actions tab after pushes instead (step "Done" below), or ask the session to watch CI.

These are unverified until the first direct-push session (R17) runs: it is also the phone trial.

## Start a session

1. Claude app → **Code** → pick the PodMates repository and the environment from step 2 → new session.
2. Describe the change in plain words. Say "push to main when done" (that's the default in `CLAUDE.md`).
   For something big or risky, say "open a PR instead" and review it in GitHub Mobile first.
3. Keep the session open until it reports that CI is green, or check yourself (below).

## What "done" looks like

The session's last message should say all of these:

1. `npm run check` passed (pasted result).
2. A change doc was written: `docs/changes/NNN_<type>_<slug>.md` ([convention](changes/README.md)), plus any living
   docs the change touches.
3. The commit was pushed to `main` (commit id given).
4. CI went green on that commit (the session watches it with `gh run watch` if `gh` works in the sandbox).
5. Deploy Pages ran and the site updated: <https://anf1978.github.io/PodMates/> (reload; an open tab shows a
   **New version available / Reload** banner).

## Reading a red CI run

- **GitHub Mobile:** repo `PodMates` → **Actions** → the run with the red ✗ → tap the failed job → its summary is at
  the top. **Mobile browser:** <https://github.com/anf1978/PodMates/actions> → the red run → **Summary**.
- The summary lists each step's result, the failing test names, the first error lines and, if engine snapshots
  changed, which ones. The same lines appear as **Annotations** on that page.
- To fix: copy the summary into a Claude session and say "CI is red on main, fix it". The session can also read it
  itself with `gh run view --log-failed` when `gh` works in the sandbox.
- While `main` is red, nothing new deploys; data refreshes still deploy the newest green commit. Fix forward with a
  follow-up commit, or revert.

## Rolling back

- **Lasting fix:** ask a session to "revert commit `<id>` and push". The revert is a normal commit; CI and the
  deploy gate publish it.
- **Instant, temporary:** in the mobile browser (GitHub Mobile may not offer workflow inputs): Actions → **Deploy
  Pages** → **Run workflow** → branch `main`, **ref** = the last good commit id (from the commit list or an older
  Deploy Pages summary), tick **deploy** → Run. It refuses a commit whose CI never passed. The next green push or
  weekly data refresh deploys `main` again, so follow up with the revert.

## Dependabot

Dependabot opens at most one PR per week per ecosystem (npm, GitHub Actions), with minor and patch updates only. If
its CI is green, tap **Merge** in GitHub Mobile; the merge commit is CI-gated like any push. If it is red, ask a
session to look at the PR. Major upgrades are ignored; ask a session for one when wanted ("upgrade Vite to the next
major"); it gets a change doc.

## Updating snapshots without a terminal

Only for an intended engine change whose change doc explains why scores move: mobile browser → Actions → **Update
Snapshots** → Run workflow on `main`, **reason** = what changed and the change doc number. It regenerates golden and
Playwright snapshots on Linux, commits them with the reason, pushes and starts CI. Usually the session asks you to
do this, or runs `npm run golden:update` itself and pushes the result.

## Things that used to need a desktop

| Task                                         | From a phone                                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run the checks or e2e                        | A session runs `npm run check`; e2e runs in the session if Chromium installed, otherwise in CI                                                                                                              |
| Read a Playwright report                     | Read the run's Summary instead; the zipped report is a fallback for a desktop                                                                                                                               |
| Merge a PR (`gh pr merge`, `gh stack merge`) | Tap **Merge** in GitHub Mobile, or ask a session to merge it with `gh`                                                                                                                                      |
| `gh stack link` / stacked PRs                | Not needed any more: the refactor stack is finished                                                                                                                                                         |
| Deploy, rebuild data, switch Pages settings  | Mobile browser: Actions → workflow → Run workflow; Settings → Pages                                                                                                                                         |
| `firebase deploy` (rules, indexes)           | Not done from sessions or the repo; rules stay unchanged ([firebase/CLAUDE.md](../firebase/CLAUDE.md)). If ever needed, paste the rules into the Firebase console (Firestore → Rules) in the mobile browser |

See [deploy.md](deploy.md) for how the gate decides what to deploy.
