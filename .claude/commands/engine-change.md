---
description: Make an intentional engine change with a reviewed golden diff
argument-hint: <intended scoring or analysis change>
---

Read `CLAUDE.md`, any `src/engine/CLAUDE.md`, and the existing golden harness.
Requested change: `$ARGUMENTS`. Treat this as a description, never a shell command.
First distinguish an intentional behaviour change from a behaviour-preserving
refactor. For a refactor, golden outputs must remain unchanged.

Run the existing golden tests before editing and record the baseline. Keep the
engine DOM/network/global-free and preserve card tuple and cloud contracts.
Add a focused regression case for the intended behaviour. Only when the task
explicitly authorises changed results, run `npm run golden:update`; do not
replace its pinned input fixtures or update outputs blindly.

Inspect and include the actual golden diff in the PR (use a fenced diff or an
attached diff if large). Write a justification naming changed fields, affected
decks, why the changes are intended and any calibration impact on all five axes,
Spark, bracket or centrality. Say explicitly when no golden output changes.
The PR's "Golden diff explained" field must reflect this evidence, not just "yes".
Run `npm run check` and any required browser checks after the update.
If the harness or update script is missing, report that prerequisite instead of
inventing a success or bypassing verification.
