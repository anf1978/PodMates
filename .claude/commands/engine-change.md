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

Write a change doc, `docs/changes/NNN_change_<slug>.md` (or `_fix_`; template in
`docs/changes/README.md`; read the earlier docs for the affected area first and add
`Later changes: NNN` to any it supersedes). Its **Testing** section carries the
golden diff evidence: `git diff --stat -- tests/golden` plus the key changed values
(a fenced diff), and a justification naming changed fields, affected decks, why the
changes are intended and any calibration impact on all five axes, Spark, bracket or
centrality. Say explicitly when no golden output changes. If you can't run the
update yourself (no `node_modules`), ask the human to run Actions → Update Snapshots
on your `claude/` branch with a `reason` naming the change doc, then pull it. When the change goes through a PR, its "Golden diff
explained" field must reflect the same evidence, not just "yes".
Run `npm run check` after the update if you can; CI on the pushed branch runs it and
the browser checks either way.
If the harness or update script is missing, report that prerequisite instead of
inventing a success or bypassing verification.
