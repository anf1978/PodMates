# Session p2-3 — Card DB decode and indexing in a Web Worker

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` task 2.2, §4.4;
`docs/overview.md` §3.4 (boot sequence, 30 s watchdog).

## Task

1. Create `src/cards/db.worker.ts`: fetch the card DB data file, decompress (`DecompressionStream`), parse, and build
   the same lookup indexes the main thread builds today. Post progress messages and a final result.
2. Transfer the result efficiently (structured clone of plain arrays/objects; transferables where possible). If
   rebuilding the indexes on the main thread from the transferred data turns out cheaper than cloning maps, do that
   and measure it.
3. Replace the main-thread decode in `index.html` with a call to the worker. Keep the same globals and the same
   `window.__dbReady` signal so the rest of the app is unaffected. Wire worker progress into the existing progress
   bar; keep the watchdog but base it on progress stalls, not total time.
4. Fallback: if `Worker` or `DecompressionStream` is unavailable, use the old main-thread path.

## Done when

- Golden unchanged; `npm run check` + `npm run e2e` green.
- PR includes before/after numbers for main-thread blocking time during boot (Performance panel or a
  `performance.mark` measurement) on a throttled mobile profile.
