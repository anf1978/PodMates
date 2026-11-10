# ADR 0001: Cloud coding sessions and pull requests (D1)

**Status:** Proposed

## Context

Whole-file chat downloads and web uploads have reverted bot-managed datasets.
The development workflow must also work from a phone.

## Decision

Propose Claude Code cloud sessions from the iOS app, with focused branches and
pull requests reviewed in GitHub. Do not upload replacement copies of `index.html`.
No human agreement was supplied; this records the recommendation, not approval.

## Consequences

Sessions can read repository instructions and run checks before review.
Small PRs suit usage limits and phone review. Branch protection and the workflow
change still require human action. See [plan D1](../refactor-plan.md#9-decisions-for-review).
