# ADR 0007: Strict TypeScript with a legacy JavaScript bridge (D7)

**Status:** Proposed

## Context

The app is being extracted incrementally from inline JavaScript. Requiring a
complete conversion first would defeat the strangler approach.

## Decision

Propose strict TypeScript for moved and new code, with `allowJs` and unchecked
legacy JavaScript during migration. Remove the bridge when Phase 3 is complete.
No human agreement was supplied; existing tooling is not proof of human approval.

## Consequences

New public APIs need explicit types and no unexplained `any`.
Legacy lint warnings and unchecked JavaScript remain migration debt, not a pattern
for new modules. D7 concerns typing, not PriceScry access control.
See [plan D7](../refactor-plan.md#9-decisions-for-review).
