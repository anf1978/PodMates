# ADR 0001: Cloud coding sessions pushing to `main` (D1)

**Status:** Accepted (revised 2026-11-11: direct pushes instead of PRs)

## Context

Whole-file chat downloads and web uploads have reverted bot-managed datasets.
The development workflow must also work from a phone. PodMates has one developer,
so pull request review is overhead rather than a safety net.

## Decision

Use Claude Code cloud sessions from the iOS app. Sessions make normal git commits,
run `npm run check`, and push straight to `main`. Do not upload replacement copies
of `index.html`. Deploys run only after CI passes on the pushed commit (p6-1).
Pull requests stay optional for large or risky changes. The refactor stack
(`docs/prompts/`) is the exception and keeps using stacked PRs until it's finished.

## Consequences

Git commits keep full history and make every change revertible. A broken push
can land on `main` but can't deploy; the fix is a follow-up commit or revert.
`main` gets no branch protection that blocks pushes, which also keeps the weekly
data bots working. Blocking force-pushes and deletion is still fine. See
[plan D1](../refactor-plan.md#9-decisions-for-review).
