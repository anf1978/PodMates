# ADR 0002: Vanilla DOM with lit-html templates (D2)

**Status:** Proposed

## Context

The existing UI uses DOM APIs and HTML template strings. A framework rewrite
would widen the scope of a behaviour-preserving extraction.

## Decision

Propose keeping vanilla DOM orchestration and gradually adopting lit-html through
a shared UI helper. Do not introduce React, Preact or Svelte as part of this refactor.
No human agreement was supplied; this records the recommendation, not approval.

## Consequences

Extraction can proceed feature by feature with escaped templates.
Shared primitives and browser tests remain necessary; this does not retroactively
make legacy `innerHTML` safe. See [plan D2](../refactor-plan.md#9-decisions-for-review).
