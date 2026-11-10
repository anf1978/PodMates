# ADR 0003: PriceScry stays in this repository (D3)

**Status:** Proposed

## Context

PriceScry shares card identities and helpers with PodMates but has distinct
price datasets, pipelines and UI.

## Decision

Propose one repository with a lazy-loaded `src/features/pricescry/` feature,
area-specific instructions and `pipelines/pricescry/` builders.
No human agreement was supplied; this records the recommendation, not approval.

## Consequences

Shared contracts can change atomically without loading PriceScry at app boot.
Feature boundaries must prevent direct cross-feature imports. Repository placement
does not decide access control: the current password is only a client-side soft gate.
See [plan D3](../refactor-plan.md#9-decisions-for-review).
