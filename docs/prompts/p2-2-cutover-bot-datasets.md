# Session p2-2 — Cut-over: bots publish data files, not `index.html` ⚠ code freeze

Follow the session rules in `docs/prompts/00-README.md`. Context: `docs/refactor-plan.md` tasks 2.1 + 2.4, §4.4,
decision **D5** (see `docs/adr/`), and the "Feature work collides" risk in §8.

**Coordinate a short freeze:** this PR is **checkpoint B** (see `docs/prompts/00-README.md`). The human merges the
stack up to and including it with `gh stack merge`, soon after it's ready and on a day other than Monday (the weekly
workflows run on Mondays, 06:00 / 07:00 UTC). Until then, no other PR touching `index.html` merges. In the PR,
remind the human of this.

## Task

1. Move `CARD_DB_COMPRESSED_B64`, `IX_TAGS_JSON` and `COMMANDER_TIER_DATA` into data files loaded through
   `loadDataset()` (same approach as p2-1). Keep the existing in-page global names.
2. Change the pipelines to **write data files** instead of splicing HTML:
   - `rebuild-card-database.yml` → `cards` (+ `tags`) data files; `rebuild-winrate-database.yml` → `winrates`.
   - Follow D5. With the recommended option (force-pushed `data` branch): workflows publish to a `data` branch, and
     `deploy.yml` checks it out and copies it into `dist/data/` at build time, then triggers a deploy. With the
     "commit on main" option, the bots commit only under `public/data/` via a PR or a direct commit; never source.
   - Keep the validation the splice scripts did (abort on suspiciously small or malformed output).
3. Delete `splice-card-db.mjs` and `splice-winrate-db.mjs`.
4. Local dev and CI need data without the `data` branch: commit a recent snapshot under `public/data/` as the
   fallback, or add a `npm run data:pull` script. Golden tests keep using the pinned fixture.
5. Update `CLAUDE.md`: remove the "never touch the data lines" rule and replace it with "never edit `public/data/**`
   by hand". Update `docs/overview.md` §3.3/§3.6.

## Done when

- `npm run check` + `npm run e2e` green; golden unchanged.
- Both weekly workflows run successfully via `workflow_dispatch` on this branch (or a fork) and produce data files
  that the built site loads. Paste the run links in the PR.
- `index.html` (with the inline JS) is under ~1.3 MB.
