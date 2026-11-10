# ADR 0006: Defer optional history cleanup (D6)

**Status:** Proposed

## Context

Historical whole-file uploads inflated repository history. Rewriting shared
history while several extraction sessions run would disrupt branches and clones.

## Decision

Propose deferring history cleanup until after the refactor, as a separate optional,
explicitly coordinated operation. Do not rewrite shared history in these sessions.
No human agreement was supplied; this records the recommendation, not approval.

## Consequences

Existing branches and review references remain usable; clone size is not fixed now.
Any future cleanup needs backups, collaborator agreement and instructions for
recreating affected clones. See [plan D6](../refactor-plan.md#9-decisions-for-review).
