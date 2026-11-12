# 002: Refactor prompts move to docs/refactor-plan/; local worktrees are ignored

Date: 2026-11-12

## Summary

The step-by-step instructions used for the big refactor (R1–R17) moved from `docs/prompts/` to
`docs/refactor-plan/`, next to the plan they came from, and every link to them was updated. A local folder of extra
checkouts (`.worktrees/`) had nearly been committed by accident; git now ignores it, and those old checkouts were
removed from the developer's computer.

## What users see

Nothing on the site.

## How it works

- `docs/prompts/*.md` → `docs/refactor-plan/*.md` (a rename; content unchanged apart from links). Links updated in
  `docs/refactor-plan.md`, the prompts themselves, ADR 0001 and change doc 001. Relative links inside the folder
  (`../refactor-plan.md`, `../../CLAUDE.md`, `../phone-workflow.md`) still resolve because the folder depth is the
  same.
- `.gitignore` ignores `.worktrees/`. Sessions that need a separate checkout put it outside the repository, for
  example `../PodMates-wt/<name>` (`git worktree add ../PodMates-wt/<name> -b claude/<topic> origin/main`). A
  worktree inside the repo shows up as an embedded repository and `git add -A` records it as a submodule-like entry.
- No data changes.

## Testing

`npm run check` (includes the change-doc test). No code changed. A search for `docs/prompts` finds no remaining
links.

## Risks and rollback

Old links to `docs/prompts/…` from outside the repository (bookmarks, chats) no longer resolve. Revert this commit
to restore the old path.

## Follow-ups

None.

## Related

001 (phone-first delivery, which named the old path).
