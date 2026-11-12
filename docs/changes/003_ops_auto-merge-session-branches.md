# 003: Changes from the Claude app's own branches merge themselves

Date: 2026-11-12

## Summary

Claude sessions started from the phone work on a branch named `ccr-…`, not the `claude/…` names the automatic
merge was set up for, so their changes would never have gone live on their own. Now those branches are tested and
merged just like `claude/` ones. Because every push that passes the tests now goes live, a session can mark
unfinished work with `[wip]` in its commit message to save it without shipping it.

## What users see

Nothing on the site. For the developer: a change made in the Claude app goes live by itself once its tests pass. Say
"don't ship it yet" to have the session hold it back with `[wip]`.

## How it works

- `ci.yml` also runs on pushes to `ccr-*` branches. `auto-merge.yml` listens for CI on `ccr-*` as well as
  `claude/**`.
- `scripts/auto-merge.sh` accepts `ccr-<id>` and `claude/<topic>` branch names, and skips a branch whose latest
  commit message contains `[wip]` (case-insensitive).
- `update-snapshots.yml` commits to and auto-merges `ccr-` branches like `claude/` ones.
- `scripts/ci-status.mjs` accepts `ccr-` branch names and mentions `[wip]` when a branch stays unmerged.
- Docs: `CLAUDE.md` Rule 1 says a cloud session stays on its `ccr-` branch, that every green push ships, how to use
  `[wip]`, and how to start a second change in the same session (rebase on `origin/main`). Also updated:
  `docs/phone-workflow.md`, `docs/deploy.md`, ADR 0001, the R17 prompt, `docs/refactor-plan/00-README.md`,
  `docs/architecture.md`, `docs/changes/README.md`, `/engine-change` and `README.md`.
- No data changes.

## Testing

`tests/auto-merge.test.ts` adds two cases: a `ccr-` branch fast-forwards `main` and is deleted, and a `[WIP]` commit
leaves `main` and the branch untouched. A nested `ccr-…/…` name is refused. `npm run check` and e2e ran locally. On
the live site, the next phone session's push should end with `node scripts/ci-status.mjs <its ccr- branch>`
printing "Done".

## Risks and rollback

- A session that pushes before it has finished ships half a change if CI passes. `CLAUDE.md` tells sessions to push
  only finished work or use `[wip]`.
- Any branch named `ccr-…` pushed to this repository by someone with write access is merged when green. Only the
  owner and the Claude app can push.
- This changes workflow files, so it lands through a PR a human merges. Revert it the same way.

## Follow-ups

- The old unmerged branch `ccr-80770cb9-3bgc4t` (a `docs/refactor-prompts` rename that clashes with 002) would
  auto-merge if anyone pushed to it again. Delete it.

## Related

001 (phone-first delivery), 002 (refactor-plan folder).
