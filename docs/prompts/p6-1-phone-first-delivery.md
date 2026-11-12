# Session p6-1 — Phone-first delivery loop

Follow the session rules in `docs/prompts/00-README.md`. Context: `docs/refactor-plan.md` §4.6, §5.3, decisions D1
and D4, and the workflows from p1-4 / p5-2.

## Why

The main developer works **only from a smartphone**, using Claude Code cloud sessions in the Claude iOS app. It's a
one-developer site, so pull requests are overhead they don't want. They have no terminal. The cloud sandbox can run
`npm run check`, but it may not be able to run everything (Playwright browsers, the Firebase emulator). They also
can't open a dev server, read a zipped Playwright report, or run `gh` themselves. The plan assumes a desktop in
several places. This session makes the loop work end to end from a phone, with **no PRs and no new accounts or
secrets**:

> Claude cloud session edits → runs `npm run check` → writes the change doc → **commits and pushes straight to
> `main`** → CI runs on `main` → deploy runs **only if CI passed** (otherwise production stays on the last good
> build) → rollback is one tap.

**Pushing to `main` is the decided workflow** (ADR 0001). The safety net is the deploy gate: a broken push can land
on `main`, but it never reaches the live site, and the next push (or a revert) fixes it. Git history stays intact.
Don't add branch protection that blocks direct pushes: it would block the sessions themselves. (The weekly data bots
no longer push to `main`; they publish to the `data` and `pricescry-data` branches. ADR 0001 still gives the old
reason; correct it.)

Because nobody reviews a direct push, **the docs are the only record of what changed and why**. This session also
sets up the documentation rules every later session follows (task 7).

## Task

1. **Gate deploy on CI.** Today `deploy.yml` runs on every push to `main` without checking CI. Make it deploy only
   after `ci.yml` succeeds on that commit, either with `workflow_run` (`conclusion == 'success'`, `head_branch ==
'main'`, and checking out `workflow_run.head_sha`) or by moving deploy into `ci.yml` as a job that `needs` the
   test jobs.
   - Make sure an older successful CI run finishing late can't deploy over a newer one (deploy `main`'s current
     head only if that commit's CI passed, or use a `concurrency` group that keeps only the latest).
   - **Data refreshes must not depend on `main` being green.** The data-workflow trigger from p1-4 / D5 must keep
     working, and it builds the **newest `main` commit whose CI passed**, not `main`'s head. Otherwise a red `main`
     would stop new card data and win rates from going live.
   - Keep `workflow_dispatch` with an optional `ref` input so a human can redeploy an older commit (rollback) from
     the mobile browser's Actions tab. A manual run with `ref` is **allowed** to deploy an older commit over a
     newer one; that's what a rollback is. It should still refuse a `ref` whose CI never passed.
2. **Direct-push session rules.** Replace the PR rule in `CLAUDE.md` with:
   - Run `npm run check` before every push. Never push with it red.
   - Commit to `main` and push. If the push is rejected (another session pushed first), run `git pull --rebase` and
     push again. Never force-push `main`.
   - One logical change per commit, with a clear message, so a bad change is one `git revert` away.
   - Every change ships with its docs in the same push (task 7).
   - After pushing, check that CI went green on that commit (with `gh run watch` if `gh` works in the sandbox).
     If it went red, fix it in a follow-up commit right away, or revert.
   - Branches and PRs are still fine for big or risky work the user wants to look at first, but they're optional.
     Check that pushing to `main` works from the cloud sandbox. If the Claude GitHub app's permissions block it,
     document the human step (repo access for the Claude app) in `docs/phone-workflow.md`.
3. **Cloud-session bootstrap.**
   - **No hooks** (removed on purpose in #24; don't add any). Instead, document the Claude cloud **environment setup
     script** in `docs/phone-workflow.md` (a human pastes it once into the Claude environment settings): `npm ci`,
     then `npx playwright install chromium || echo "e2e runs in CI only"`.
   - `CLAUDE.md` already tells sessions to run `npm run check` before finishing; make sure it says "before every
     push" too.
   - If the sandbox's default network allowlist blocks something it needs, list the domains in
     `docs/phone-workflow.md` as a human step (Claude environment settings). Don't work around it.
4. **CI output a phone can read.**
   - Each job writes a short Markdown summary to `$GITHUB_STEP_SUMMARY`: failing test names, the first error lines,
     and the golden diff stats.
   - When CI fails on `main`, state in `docs/phone-workflow.md` exactly where to tap to see why (repo → Actions →
     the red run → Summary), and how to get a phone notification for a red run (GitHub Mobile notification
     settings for Actions).
   - Goal: the developer can read why it failed on their phone, or paste it into Claude, without downloading
     artifacts. Mention that the Claude session can read the failure itself with `gh run view --log-failed` if `gh`
     works.
5. **No PR previews.** Don't add a preview host. Previews would need a new hosting setup, a service-account secret,
   and Firebase Auth authorized domains for each preview (no wildcards), which is too much for a phone-only
   one-developer site. Record this in `docs/adr/0008-no-pr-previews.md`: try changes on the live site after the
   CI-gated deploy, and roll back with one tap if needed. Reconsider only if the humans ask for previews.
6. **Snapshot updates without a terminal.** Add a `workflow_dispatch` workflow `update-snapshots.yml` (default ref
   `main`) with a **required `reason` input**. It runs `npm run golden:update` and Playwright `--update-snapshots`
   on Linux and commits the result to the ref it ran on, with the reason in the commit message.
   - Pushes made with `GITHUB_TOKEN` don't trigger other workflows, so dispatch `ci.yml` for that ref afterwards
     (the deploy gate then sees a green CI on the new commit).
   - The `/engine-change` rule still applies: the change that alters engine behaviour must say why the golden diff
     is expected (in its change doc and the `reason`).
7. **Documentation rules: docs ship with every change.**
   - **Change docs.** Create `docs/changes/` with a `README.md` that defines the convention and a template. Every
     change gets one numbered doc, named `NNN_<type>_<slug>.md`, for example `004_feature_pods.md` or
     `005_fix_appearance.md`:
     - `NNN`: three digits, the highest existing number + 1. If `git pull --rebase` shows another push took your
       number, rename yours to the next free one (and fix links) before pushing.
     - `<type>`: `feature` (new capability), `fix` (bug fix), `change` (alters existing behaviour or looks),
       `refactor` (no behaviour change), `ops` (CI, deploy, tooling, data pipelines).
     - `<slug>`: lowercase kebab-case. A feature's first doc uses the feature folder name (`feature_pods`).
     - Only trivial changes skip a doc: typos, formatting, dependency bumps.
     - Template sections: title and date; **Summary** (what and why, in plain English for a non-programmer);
       **What users see**; **How it works** (files and modules, data: Firestore paths, datasets, local storage
       keys); **Testing** (automated tests, plus how to try it on the live site); **Risks and rollback**;
       **Follow-ups**; **Related** (earlier doc numbers).
     - When a change alters something an earlier doc describes, add `Later changes: NNN` at the bottom of that
       earlier doc so a reader can follow the chain. Don't rewrite old docs otherwise; they're history.
     - Before changing a feature, read its docs in `docs/changes/` first.
   - **Living docs.** Add a table to `CLAUDE.md` saying which docs each kind of change must also update, in the same
     push: code moves or new modules → `CLAUDE.md` map and `docs/architecture.md`; commands, workflows, deploy →
     `CLAUDE.md` Commands, `docs/deploy.md`, `docs/phone-workflow.md`; new domain terms → `docs/glossary.md`;
     lasting decisions → a new ADR. The pre-push checklist ends with "docs updated".
   - Update `/new-feature` and `/engine-change` (`.claude/commands/`) so they write the change doc too.
   - Add a test to `npm run check` that every file in `docs/changes/` (except `README.md`) matches the name
     pattern, numbers are unique, and each has the template's headings. (R17 adds the "every feature has a doc"
     check after it backfills them.)
   - This session's own doc is `docs/changes/001_ops_phone-first-delivery.md`.
8. **`docs/phone-workflow.md`** (short, step by step with screenshots-in-words): start a session in the Claude app,
   what "done" looks like (check green, change doc written, pushed, CI green, deployed), reading a red CI run,
   rolling back. Rollback options: ask Claude to `git revert` the bad commit and push (the lasting fix), or
   `deploy.yml` → Run workflow with an older `ref` (instant, but the next push to `main` deploys again). Link it
   from `CLAUDE.md` and `README.md`.
9. **Dependabot from a phone.** Group Dependabot updates so they arrive as one weekly PR per ecosystem and ignore
   major-version bumps (a Claude session does those on request, with a change doc). In `docs/phone-workflow.md`,
   say how to handle a Dependabot PR: tap Merge in the GitHub app if CI is green, otherwise ask a Claude session to
   look at it. Don't merge or close the existing Dependabot PRs; list them under Follow-ups.
10. Review `00-README.md` "Human-only tasks" and `docs/deploy.md` for steps that need a desktop CLI
    (`gh stack merge`, `gh stack link`, `firebase` CLI). Add a phone equivalent for each, or note that a Claude cloud
    session can run it on the human's behalf. The stacked-PR refactor workflow is finished by the time this lands;
    mark it as historical in `00-README.md` (except R17, which uses the new workflow) so future sessions follow the
    direct-push rules instead.

## Out of scope

Changing the production host, adding branch protection, PR previews, or creating secrets. Backfilling docs for
existing features (that's R17). Tighten the workflow security pinning from p5-2, but don't loosen it.

## Done when

- CI is green on this PR (the last refactor PR still goes through review as a PR against `main`), and the step
  summary shows up.
- You've shown that a failing check stops `deploy.yml`, and that a data refresh still deploys the last green
  commit, with a dry run or a clear explanation of the trigger logic.
- `docs/changes/README.md`, `001_ops_phone-first-delivery.md` and the naming test exist.
- `docs/phone-workflow.md` exists. The PR lists every step that still needs a human (Claude app repo access,
  environment setup script, network allowlist, GitHub Mobile notifications). R17 is the first session run through
  the new workflow and doubles as the phone trial.
