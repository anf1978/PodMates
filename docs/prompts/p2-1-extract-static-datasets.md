# Session p2-1 — Move hand-maintained datasets out of `index.html`

Follow the session rules in `docs/prompts/00-README.md`. Context: `docs/refactor-plan.md` §4.4 and task 2.1;
`docs/overview.md` §3.3 (dataset table) and §3.4 (boot sequence).

## Scope

Only datasets that **no bot rewrites**: `SPELLBOOK_SNAPSHOT_B64`, `KNOW_JSON`, `IMPACT_CANDS`, `REFERENCE_SCORES`,
`REFERENCE_TIERS`, `PRECON_FINGERPRINTS`, `STAPLES_BASELINE`, `MANABASE_BASELINE`, `TRY_A_DECK_OPTIONS` (decklists).
Leave `CARD_DB_COMPRESSED_B64`, `IX_TAGS_JSON` and `COMMANDER_TIER_DATA` alone; they move in p2-2. Small hand-curated
code-like tables (`HARD_COMBOS`, `SOFT_SYNERGIES`, `DEFAULT_IMPACT_CARDS`, `GAME_CHANGER_REASONS`) stay in code; they
move to `src/data/*.ts` in Phase 3.

## Task

1. Add a small typed loader `src/data/load-dataset.ts`: `loadDataset<T>(name)` fetches
   `${import.meta.env.BASE_URL}data/<name>.json` (gzip/base64 handling where the dataset needs it), caches the
   promise, and reports progress to the existing boot progress bar.
2. Write each dataset **byte-for-byte equivalent** to `public/data/<name>.json` (or keep the existing encoding if
   decoding changes would be risky). Use a one-off extraction script under `scripts/`, then commit the script and its
   output.
3. Replace each inline constant with an awaited load **before** the first code that reads it, keeping the existing
   global names for now (e.g. assign `window.SPELLBOOK_SNAPSHOT_B64` / set the same top-level binding) so the rest of
   `index.html` is unchanged. Gate "DB ready" on these loads in the same place the boot sequence already waits.
4. Update the golden harness to read the extracted files instead of the inline constants, keeping golden snapshots
   **unchanged**.

## Done when

- Golden snapshots unchanged; `npm run check` and `npm run e2e` green.
- `index.html` size reduction and the new `public/data/` file sizes are reported in the PR.
- Bot-managed lines untouched (`git diff -U0 main -- index.html` shows none of the three).
- `CLAUDE.md` line map updated.
