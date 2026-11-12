# Session p2-4 — Lazy-load feature data + "data as of" manifest

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` tasks 2.3 and 2.5, §4.4.

## Task

1. **Lazy-load** datasets only some features need: Try-a-Deck decklists, `KNOW_JSON`, `PRECON_FINGERPRINTS` (and any
   other dataset not needed for the first chart). Load them when the feature first opens, and show the existing
   loading UI while waiting. Check every reader (grep) to make sure nothing reads them synchronously at boot. If the
   engine needs one for every analysis, it stays eager; document which and why.
2. **`data/manifest.json`**: written by the pipelines (and the p2-1 extraction script) with, per dataset: `version`,
   `generatedAt` (ISO date), `sha256`, `bytes`, `source`. `loadDataset()` reads the manifest first and uses the hash
   for cache-busting (`?v=<hash>`).
3. **UI footer:** show "Card data as of <date> · Win-rates as of <date>" in the existing footer/about area, with no
   other visual change. Warn quietly (console + subtle text) if card data is more than 14 days old; that would have
   exposed the stale-data bug.

## Done when

- Golden unchanged; `npm run check` + `npm run e2e` green (extend the smoke test to assert the footer date exists).
- PR reports first-load transfer size before and after.
