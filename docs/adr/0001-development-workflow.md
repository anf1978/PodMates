# ADR 0001: Cloud coding sessions pushing to `main` (D1)

**Status:** Accepted (revised 2026-11-11: direct pushes instead of PRs)

## Context

Whole-file chat downloads and web uploads have reverted bot-managed datasets.
The development workflow must also work from a phone. PodMates has one developer,
so pull request review is overhead rather than a safety net.

## Decision

Use Claude Code cloud sessions from the iOS app. Sessions make normal git commits,
run `npm run check`, write a change doc (`docs/changes/`) and push straight to `main`.
Do not upload replacement copies of `index.html`. Deploys run only after CI passes on
the pushed commit (p6-1, `docs/deploy.md`). Pull requests stay optional for large or
risky changes. The stacked-PR refactor (`docs/prompts/`, R1–R16) is finished and was
the last work done through PRs by default. How-to: [phone-workflow.md](../phone-workflow.md).

## Consequences

Git commits keep full history and make every change revertible. A broken push
can land on `main` but can't deploy; the fix is a follow-up commit or revert.
`main` gets no branch protection that blocks pushes, because the sessions themselves
push to it. (The weekly data bots no longer push to `main`: they publish to the `data`
and `pricescry-data` branches.) Blocking force-pushes and deletion is still fine.
With no reviewer, the change docs are the record of what changed and why. See
[plan D1](../refactor-plan.md#9-decisions-for-review).
