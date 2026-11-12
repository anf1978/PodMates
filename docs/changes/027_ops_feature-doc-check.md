# 027: Every feature must have a feature doc

Date: 2026-11-12

## Summary

Changes now reach the live site without anyone reviewing them, so the docs are the only record of how each part of
the site works. Every feature folder now has a doc (`005`–`019`, `021`–`026`), and a new automatic check makes sure
it stays that way: if someone adds a feature without writing its doc, the tests fail and the change cannot ship. This
finishes the R17 refactor session.

## What users see

Nothing on the site. For the developer: `npm run check` (and CI) fails with "add docs/changes/NNN_feature_<name>.md"
when a folder in `src/features/` has no feature doc.

## How it works

- `tests/feature-docs.test.ts` (part of `npm run test`, so of `check`): for every folder in `src/features/`, some file
  in `docs/changes/` must match `NNN_feature_<name>.md` or `NNN_feature_<name>-<more>.md`.
- `/new-feature` (`.claude/commands/new-feature.md`) already writes `docs/changes/NNN_feature_<name>.md` in the same
  commit as the scaffold (added by p6-1), so new features pass the check; no change needed.
- `docs/changes/README.md` states the rule; the `CLAUDE.md` Commands line names the new test.
- `docs/refactor-plan/00-README.md` marks R16 and R17 done.
- `docs/phone-workflow.md`, "When something is red", gains two lessons from this session: another session merged a
  doc numbered `003` (taken), turning CI on `main` red until it was renumbered, and frequent `ci-status.mjs` polling
  hit GitHub's unauthenticated rate limit.

No data changes.

## Testing

Ran `tests/feature-docs.test.ts` and `tests/change-docs.test.ts` locally (all passed), and confirmed the new
test fails with the expected message when a feature doc (`025`) is moved away. CI runs the full `npm run check`.

## Risks and rollback

A false failure would block shipping until fixed; the check only reads file names. Undo with `git revert`.

## Follow-ups

- `scripts/ci-status.mjs` could catch the 403 rate-limit reply and print a plain "rate limited, try again at HH:MM"
  instead of a stack trace.
- Auto-merge rebases a branch and pushes it without re-running `tests/change-docs.test.ts` on the rebased tree, so a
  duplicate doc number is only caught by CI on `main`. Running that one fast test before the push would keep `main`
  green.

## Related

`001` (change docs and their test), `004` (refactor summary), `005`–`019` and `021`–`026` (the feature docs).
