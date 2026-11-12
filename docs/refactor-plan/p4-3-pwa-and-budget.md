# Session p4-3 — Service worker, caching and bundle budget

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` §4.4, Phase 4, §10
targets, decision D4.

## Task

1. Add `vite-plugin-pwa` (Workbox, `generateSW`), reusing the existing `manifest.webmanifest` and icons unchanged.
   - Precache the app shell and hashed JS/CSS chunks.
   - Data files: `StaleWhileRevalidate` keyed by the manifest hash (so a new weekly dataset is picked up), and
     `CacheFirst` for Scryfall card images with an expiry/size cap.
   - **Never cache** Firestore/Auth requests or the Worker.
   - Update flow: show a non-intrusive "New version available — reload" prompt; no forced reloads mid-session.
2. Make sure a broken service worker can't brick the site: add a documented kill-switch (e.g. deploying a
   self-unregistering SW) in `docs/deploy.md`.
3. Bundle budget in CI: fail if initial JS+CSS (gzip) exceeds the plan §10 target (< 1.5 MB including boot data;
   choose a sensible JS-only budget and record it). Use `size-limit` or a small script over `dist/`.
4. e2e: second visit works offline for the deck chart (cached card DB) and loads only changed chunks after a code
   change.

## Done when

`npm run check` + `npm run e2e` green; the PR reports first-visit and repeat-visit transfer sizes vs plan §10.
