---
description: Run the repository's required verification without rewriting baselines
---

Read `CLAUDE.md` and the nearest area instructions. Run `npm run check` from the
repository root. Report the result and fix failures caused by this change; do not
hide failures, weaken checks or regenerate golden outputs to make a refactor pass.
Run `npm run e2e` for UI/boot changes, and any area-specific checks required by the
task. Inspect `git diff` afterward for unintended formatter or generated-data edits.
Do not declare completion while a required check is failing.
