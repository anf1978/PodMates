# ADR 0001: Cloud sessions ship through self-merging branches (D1)

**Status:** Accepted (revised 2026-11-11: no PR review; revised 2026-11-12: `claude/` branches that merge
themselves when CI passes, instead of pushing straight to `main`)

## Context

Whole-file chat downloads and web uploads have reverted bot-managed datasets.
The development workflow must also work from a phone. PodMates has one developer,
so pull request review is overhead rather than a safety net. A cloud session may
be unable to run the tests (no browsers, no Java, slow or missing installs), and
the phone shouldn't pay for them anyway: GitHub's runners should.

## Decision

Use Claude Code cloud sessions from the iOS app. Sessions make normal git commits
with a change doc (`docs/changes/`) on a `claude/<topic>` branch and push it. Do not
upload replacement copies of `index.html`. CI runs the full test suite on the
branch. When it passes, the Auto-merge workflow rebases the branch onto `main` and
pushes it, runs CI on `main`, and starts the deploy, which only publishes commits
whose CI passed (p6-1, `docs/deploy.md`). Nobody approves anything. A `wip/` branch
plus a pull request is the optional route when a human wants to look first. The
stacked-PR refactor (`docs/refactor-plan/`, R1–R16) is finished. How-to:
[phone-workflow.md](../phone-workflow.md).

## Consequences

`main` only receives commits that passed CI on their branch, so parallel sessions
start from a green base. Clashes between two merges are caught by CI on `main`, and
the deploy gate keeps a red `main` off the live site. Git history keeps every commit
and makes each one revertible. `main` gets no branch protection that blocks pushes,
because Auto-merge pushes to it with the Actions token. Blocking force-pushes and
deletion is fine. The Actions token can't push workflow-file changes, so those go
through a PR that a human merges. The weekly data bots don't touch `main`: they
publish to the `data` and `pricescry-data` branches. With no reviewer, the change
docs are the record of what changed and why. See
[plan D1](../refactor-plan.md#9-decisions-for-review).
