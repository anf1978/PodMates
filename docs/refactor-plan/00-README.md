# Refactor session prompts

> **The stacked-PR workflow below is historical.** It ran R1–R16 (PRs #44–#68 and the p6-1 PR). From R17 on, every
> session follows Rule 1 and "Docs ship with every change" in [`CLAUDE.md`](../../CLAUDE.md) and
> [`docs/phone-workflow.md`](../phone-workflow.md): change doc, push a `claude/` branch, CI, Auto-merge, deploy. No
> `gh stack`, no waiting for predecessors. Only "Current status" and "Human-only tasks" below are still current.

The [refactor plan](../refactor-plan.md) split into prompts that **one AI coding session can each finish as one
PR** (Claude Code cloud session, Copilot agent, etc.). All the PRs form **one stacked-PR chain** managed with
[`gh stack`](https://gh.io/stacks): each session's PR is based on the previous prompt's PR, in the
[stack order](#stack-order) below. To use one: start a new session, paste the prompt file's contents (or say _"Do
the task in `docs/refactor-plan/<file>`"_), and the session follows the [stacking procedure](#stacking-procedure). You can
run several sessions at the same time; each one waits for its predecessor where needed. Review the PRs as they
arrive and merge the stack at the [checkpoints](#merge-checkpoints).

## Current status (read this first, 2026-11-12)

**Merged to `main`:** everything up to and including R15 `p5-3-shared-code` (the R1–R15 stack, PRs #44–#68, merged
2026-11-12). `index.html` is static markup now. There are **no Claude hooks** in the repo (removed in #24; never add
them back). The `pre-refactor` tag marks the last commit before the refactor (a manual save point for the humans,
not a rollback target for sessions).

**Remaining sessions:**

| #   | Branch                      | Prompt                                 | How it lands                                                                            |
| --- | --------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| R16 | `p6-1-phone-first-delivery` | [p6-1](./p6-1-phone-first-delivery.md) | PR against `main` (everything below is merged, so no stack); a human reviews and merges |
| R17 | `claude/…` (auto-merged)    | [p6-2](./p6-2-feature-docs.md)         | After R16 is merged: the first session using the branch workflow, and the phone trial   |

**Done (historical):** the R1–R15 table below records how the stack ran. A session's predecessor was the row above
it; the first one based on `main`.

| #   | Branch                           | Prompt                                                                                                        | Predecessor |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| R1  | `p3-5-02-try-a-deck-export-scan` | [p3-5](./p3-5-feature-template.md), FEATURE = `try-a-deck`, `export`, `scan-cards`                            | `main`      |
| R2  | `p3-5-03-deck-crafter`           | p3-5, FEATURE = `deck-crafter`                                                                                | R1          |
| R3  | `p3-5-04-auth-profile`           | p3-5, FEATURE = `auth`, `profile`                                                                             | R2          |
| R4  | `p3-5-05-pods`                   | p3-5, FEATURE = `pods`                                                                                        | R3          |
| R5  | `p3-5-06-gatherings`             | p3-5, FEATURE = `gatherings`                                                                                  | R4          |
| R6  | `p3-5-07-chronicles`             | p3-5, FEATURE = `chronicles`                                                                                  | R5          |
| R7  | `p3-5-08-impact`                 | p3-5, FEATURE = `impact`                                                                                      | R6          |
| R8  | `p3-5-09-spoiler-bait`           | p3-5, FEATURE = `spoiler-bait`                                                                                | R7          |
| R9  | `p3-5-10-trades`                 | p3-5, FEATURE = `trades`                                                                                      | R8          |
| R10 | `p3-5-11-notifications`          | p3-5, FEATURE = `notifications`                                                                               | R9          |
| R11 | `p3-5-12-ledger-comparison`      | p3-5, FEATURE = `ledger`, `comparison`                                                                        | R10         |
| R12 | `p3-5-13-themes`                 | p3-5, FEATURE = `themes`                                                                                      | R11         |
| R13 | `p3-5-14-pricescry`              | p3-5, FEATURE = `pricescry`                                                                                   | R12         |
| R14 | `p3-6-remove-shims-2`            | [p3-6](./p3-6-remove-shims.md): finish what #25 deferred (see `docs/architecture.md`, "What is not done yet") | R13         |
| R15 | `p5-3-shared-code`               | [p5-3](./p5-3-shared-code.md)                                                                                 | R14         |

After R16 merges, the stacked-PR workflow ends: sessions push `claude/` branches that merge themselves when CI
passes (ADR 0001), starting with R17.
The sections from "Order and dependencies" to "Rules for every session" record how R1–R16 ran; don't follow them.

## Order and dependencies

Sessions on the same row can **work** in parallel, but their PRs still join the stack in the order of the
[stack order](#stack-order) table (left to right within a row).

| Step | Prompt                                                                                                                                                                                                                        | Needs (below it in the stack)     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 0a   | [p0-1-repo-hygiene](./p0-1-repo-hygiene.md)                                                                                                                                                                                   | —                                 |
| 0b   | [p0-2-interim-claude-md](./p0-2-interim-claude-md.md)                                                                                                                                                                         | — (parallel with 0a)              |
| 1a   | [p1-1-tooling](./p1-1-tooling.md)                                                                                                                                                                                             | 0a                                |
| 1b   | [p1-2-golden-harness](./p1-2-golden-harness.md) · [p1-3-e2e-smoke](./p1-3-e2e-smoke.md)                                                                                                                                       | 1a                                |
| 1c   | [p1-4-ci-deploy](./p1-4-ci-deploy.md)                                                                                                                                                                                         | 1b (both)                         |
| 1d   | [p1-5-ai-workspace-setup](./p1-5-ai-workspace-setup.md)                                                                                                                                                                       | 1a                                |
| 2a   | [p2-1-extract-static-datasets](./p2-1-extract-static-datasets.md)                                                                                                                                                             | 1c                                |
| 2b   | [p2-2-cutover-bot-datasets](./p2-2-cutover-bot-datasets.md) ⚠ **code freeze**                                                                                                                                                 | 2a                                |
| 2c   | [p2-3-card-db-worker](./p2-3-card-db-worker.md) · [p2-4-lazy-load-and-manifest](./p2-4-lazy-load-and-manifest.md)                                                                                                             | 2b                                |
| 3a   | [p3-1-cards-and-parser](./p3-1-cards-and-parser.md)                                                                                                                                                                           | 2c                                |
| 3b   | [p3-2-engine](./p3-2-engine.md)                                                                                                                                                                                               | 3a                                |
| 3c   | [p3-3-cloud-repositories](./p3-3-cloud-repositories.md) · [p3-4-ui-primitives](./p3-4-ui-primitives.md)                                                                                                                       | 2c (parallel with 3a/3b)          |
| 3d   | [p3-5-feature-template](./p3-5-feature-template.md) — **run once per feature**, in the listed order                                                                                                                           | 3b, 3c                            |
| 3e   | [p3-6-remove-shims](./p3-6-remove-shims.md)                                                                                                                                                                                   | all 3d runs                       |
| 4    | [p4-1-firestore-rules-tests](./p4-1-firestore-rules-tests.md) · [p4-2-rendering-security](./p4-2-rendering-security.md) · [p4-3-pwa-and-budget](./p4-3-pwa-and-budget.md) · [p4-4-a11y-and-errors](./p4-4-a11y-and-errors.md) | 3e (4-1 only needs 1c)            |
| 5    | [p5-1-pipelines-move](./p5-1-pipelines-move.md) → [p5-2-workflows-tidy](./p5-2-workflows-tidy.md)                                                                                                                             | 2b (parallel with Phase 3)        |
| 5    | [p5-3-shared-code](./p5-3-shared-code.md)                                                                                                                                                                                     | 5-1 and the `pricescry` run of 3d |
| 6    | [p6-1-phone-first-delivery](./p6-1-phone-first-delivery.md)                                                                                                                                                                   | 1c, 1d, 5-2                       |

## Stack order

The stack is linear, bottom (closest to `main`) to top, in this order. The branch name is fixed so sessions can find
each other. A session's **predecessor** is the row above it.

| #   | Branch (= prompt file name)                    |     | #   | Branch                       |
| --- | ---------------------------------------------- | --- | --- | ---------------------------- |
| 1   | `p0-1-repo-hygiene`                            |     | 20  | `p3-5-05-pods`               |
| 2   | `p0-2-interim-claude-md`                       |     | 21  | `p3-5-06-gatherings`         |
| 3   | `p1-1-tooling`                                 |     | 22  | `p3-5-07-chronicles`         |
| 4   | `p1-2-golden-harness`                          |     | 23  | `p3-5-08-impact`             |
| 5   | `p1-3-e2e-smoke`                               |     | 24  | `p3-5-09-spoiler-bait`       |
| 6   | `p1-4-ci-deploy`                               |     | 25  | `p3-5-10-trades`             |
| 7   | `p1-5-ai-workspace-setup` — **checkpoint A**   |     | 26  | `p3-5-11-notifications`      |
| 8   | `p2-1-extract-static-datasets`                 |     | 27  | `p3-5-12-ledger-comparison`  |
| 9   | `p2-2-cutover-bot-datasets` — **checkpoint B** |     | 28  | `p3-5-13-themes`             |
| 10  | `p2-3-card-db-worker`                          |     | 29  | `p3-5-14-pricescry`          |
| 11  | `p2-4-lazy-load-and-manifest`                  |     | 30  | `p3-6-remove-shims`          |
| 12  | `p3-1-cards-and-parser`                        |     | 31  | `p4-1-firestore-rules-tests` |
| 13  | `p3-2-engine`                                  |     | 32  | `p4-2-rendering-security`    |
| 14  | `p3-3-cloud-repositories`                      |     | 33  | `p4-3-pwa-and-budget`        |
| 15  | `p3-4-ui-primitives`                           |     | 34  | `p4-4-a11y-and-errors`       |
| 16  | `p3-5-01-deck-chart`                           |     | 35  | `p5-1-pipelines-move`        |
| 17  | `p3-5-02-try-a-deck-export-scan`               |     | 36  | `p5-2-workflows-tidy`        |
| 18  | `p3-5-03-deck-crafter`                         |     | 37  | `p5-3-shared-code`           |
| 19  | `p3-5-04-auth-profile`                         |     | 38  | `p6-1-phone-first-delivery`  |

If one session splits its work into several PRs, it adds them as consecutive branches named `<branch>-2`,
`<branch>-3`, … directly on top of its own branch. Its successor then stacks on the last of them.

## Stacking procedure

Every session does this instead of "branch from `main`". Commands are bash; use the equivalent in other shells.

1. **Tools.** Make sure `gh` is authenticated and the extension is installed: `gh extension install github/gh-stack`
   (no-op if present). If `gh` is unavailable in your environment, use the [fallback](#fallback-without-gh).
2. **Wait for your predecessor.** It is _ready_ when its PR (head branch from the table, plus any `-2`, `-3`, …
   splits) exists and is **not a draft**. Poll until it is:

   ```bash
   PRED=p1-1-tooling   # the row above yours
   until [ "$(gh pr list --repo anf1978/PodMates --state all --limit 200 --json headRefName,isDraft \
     --jq "map(select(.headRefName == \"$PRED\" or (.headRefName | startswith(\"$PRED-\")))) | length > 0 and all(.isDraft | not)")" = true ]; do
     echo "waiting for $PRED"; sleep 300
   done
   ```

   While waiting you may read code and plan. If your **dependencies** (the "Needs" column) are already in the stack
   and only a parallel sibling is missing, you may also start the work on top of the current top of the stack, then
   rebase onto your predecessor once it is ready (`gh stack rebase`), before submitting. If you can't wait any
   longer (session limits), commit locally if possible and stop with a clear "waiting for `<PRED>`" message; never
   submit out of order.

3. **Pick your base.** Use the _nearest predecessor whose PR is still open_ (merged ones are skipped; see
   checkpoints). If every predecessor is merged, the base is `main`.
4. **Create your branch on the stack.** One of three cases:

   ```bash
   # a) Base PR is already in a stack on GitHub (normal case):
   gh stack checkout <base-PR-number>   # pulls the stack locally and switches to it
   gh stack view --short                # the base branch must be the top; if not, stop and report the order problem
   gh stack add <your-branch>

   # b) Base PR exists but isn't in a stack yet ("PR #N is not part of a stack"), e.g. the first link:
   git fetch origin <base> && git checkout -B <base> origin/<base>
   gh stack init <base> <your-branch>   # adopts the base and creates your branch on top

   # c) Every predecessor is merged, so the base is main:
   git checkout main && git pull && gh stack init <your-branch>
   ```

   Then run `gh stack sync` so you start from the latest `main` + stack.

5. **Work and commit** on your branch only. Never commit to another session's branch.
6. **Submit.** Run `gh stack sync`, run the verification, then `gh stack submit --auto --open`. That pushes with
   `--force-with-lease`, creates your PR with the predecessor's branch as its base, and links it into the stack.
   Then set the real title and description with `gh pr edit <your-branch> --title … --body-file …`.
   **Submitting (non-draft) is the signal your successor waits for**, so do it only when your work is complete. Draft
   PRs pushed earlier (`gh stack submit --auto` without `--open`) are fine for visibility.
7. **Later updates** (review fixes): commit on your branch, then `gh stack sync`. If a push is rejected because a
   lower session rebased the stack, run `gh stack sync` again. Never use a plain `git push --force`.

**Rebase conflicts on bot-managed data lines** (`CARD_DB_COMPRESSED_B64`, `IX_TAGS_JSON`, `COMMANDER_TIER_DATA`,
until checkpoint B is merged): on branches _below_ `p2-2-cutover-bot-datasets`, always take the version from
`origin/main`, because the weekly bots own those lines. On `p2-2` and above, keep the lines removed (p2-2 moved that
data into files).

### Fallback without `gh`

Branch from your base with plain git (`git fetch origin <base> && git checkout -b <your-branch> origin/<base>`),
push, and open a PR with `<base>` as its base branch. In the PR description and your final message, ask the human
to run `gh stack link <base-PR> <your-PR>` to add it to the stack.

## Merge checkpoints

The human merges with `gh stack merge <PR>`, which merges everything from the bottom of the stack up to that PR
atomically. Sessions above a checkpoint can carry on stacking while it's being merged; `gh stack sync` retargets
them onto `main`.

- **Checkpoint A, after `p1-5-ai-workspace-setup`:** merge the stack up to here. CI and deploy only take effect on
  `main`, and the branch protection / Pages switch below need them.
- **Checkpoint B, after `p2-2-cutover-bot-datasets`:** merge the stack up to here **on a day other than Monday**
  (the weekly bots run Mondays 06:00 / 07:00 UTC) and soon after it's ready. Until then, the bots keep rewriting
  `index.html` on `main` while the stack restructures it, which causes rebase conflicts. Merge this checkpoint before
  stacking much Phase 3 work on top.
- **Final:** merge the rest whenever you like, in one go or in chunks.

## Human-only tasks (not for an AI session)

These need console access, a decision, or repo-admin rights. Each has a phone route; where a desktop CLI used to be
needed, a Claude cloud session can usually run it on the human's behalf.

- **Done:** switch GitHub Pages to "GitHub Actions" (plan 1.5), merge the R1–R15 stack.
- **Next Monday:** confirm the weekly rebuilds on `main` succeed and are each followed by a green **Deploy Pages**
  run (GitHub Mobile → Actions). They haven't run on `main` since the data-branch cutover.
- **Now (after the p6-1 PR merges):** the one-time phone setup in [`docs/phone-workflow.md`](../phone-workflow.md)
  (Claude app repo access incl. workflow files, environment setup script, network allowlist if needed, GitHub
  Mobile notifications for failed runs). Then check the first deploy after the merge as listed in
  [`docs/deploy.md`](../deploy.md) "Verification boundary".
- **Any time:** recover the missing pieces (plan 0.3, Appendix B): Worker source, `know-build.cjs`,
  `impact-cands.cjs`, corpus scripts, Firestore indexes. Paste them into a session (phone) and ask it to commit them
  unchanged at the paths in plan §4.3.
- **Branch protection:** don't add any that blocks pushes to `main`: Auto-merge pushes there (ADR 0001). Blocking
  force-pushes and deletion of `main` is fine (mobile browser: Settings → Rules → Rulesets).
- **Merging PRs** (Dependabot, or an optional PR for risky work): tap **Merge** in GitHub Mobile, or ask a session to
  run `gh pr merge`. `gh stack merge` / `gh stack link` are no longer needed.
- **Firestore rules and indexes:** never deployed from a session (`firebase/CLAUDE.md`). There is no phone route for
  the `firebase` CLI; if a deployment is ever decided, paste the reviewed rules into the Firebase console
  (Firestore → Rules) in the mobile browser.
- **Decisions:** agree on the Proposed ADRs (D2–D8) and tell a session to mark them Accepted; decide the PriceScry
  access model (D3/D7). **Later:** history rewrite (D6), which needs a force-push and is the one task to do with a
  desktop or a session the human watches closely.

## Rules for every session

_Historical (R1–R16). Sessions from R17 on follow `CLAUDE.md` instead._ Every prompt says "follow the session rules in `docs/refactor-plan/00-README.md`". They are:

1. **Stack, don't branch from `main`.** Follow the [stacking procedure](#stacking-procedure): wait for your
   predecessor, branch on top of it with `gh stack`, use the branch name from the [stack order](#stack-order), and
   submit with `gh stack submit`. Never push to `main`, never merge, never commit to another session's branch.
2. **Never regenerate or rewrite `index.html` wholesale.** Edit only the lines you need. Until checkpoint B is merged,
   never touch the bot-managed data lines (`const CARD_DB_COMPRESSED_B64 = …`, `const IX_TAGS_JSON = …`,
   `const COMMANDER_TIER_DATA = …`) except in p2-2, whose job is to move them, because the weekly workflows splice
   them on `main`.
3. **No behaviour change** unless the prompt asks for it: no visual changes, no Firestore path or field changes, and
   no score changes (golden tests must stay unchanged once they exist).
4. **Stay in scope.** If you find something else worth fixing, list it under "Follow-ups" in the PR description.
5. **Verify before finishing:** run `npm run check` (once it exists) and any commands the prompt lists. Paste the
   results into the PR description.
6. **PR description:** what changed, how it was verified, risks, follow-ups. Keep each PR reviewable on a phone
   (prefer < ~800 changed lines, excluding moved/generated files; split into several stacked PRs if needed, named as
   in [stack order](#stack-order)).
7. **Keep docs current:** update `CLAUDE.md` (map/line map) and `docs/` if the change affects them. If a step in the
   plan turns out to be wrong, say so in the PR instead of silently changing the approach.
8. Never commit secrets. The Firebase web `apiKey` is public by design; anything else stays out of the repo.
