# ADR 0005: Publish generated datasets on a data branch (D5)

**Status:** Proposed

## Context

Weekly bots currently splice datasets into source on `main`, causing conflicts
and accidental data reversions. PriceScry already publishes to a data branch.

## Decision

Propose publishing generated app datasets to a force-updated `data` branch and
assembling them with the app at deploy time. Keep `pricescry-data` separate.
No human agreement was supplied; this records the recommendation, not approval.

## Consequences

Bots stop editing source after the coordinated Phase 2 cutover, not before.
Deploys must record the exact data revision and manifest hashes for reproducibility;
a moving branch name alone is insufficient. Generated files are never hand-edited.
See [plan D5](../refactor-plan.md#9-decisions-for-review).
