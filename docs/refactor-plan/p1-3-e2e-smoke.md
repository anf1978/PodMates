# Session p1-3 — Playwright smoke test

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` task 1.3 and §7;
`docs/overview.md` §2.1 and §3.4 (boot sequence).

## Task

1. Add Playwright (Chromium only for now) and `@axe-core/playwright` (not asserted yet). Config starts
   `vite preview` (or `vite dev`) as the web server.
2. `tests/e2e/smoke.spec.ts`:
   - page loads and the card DB reaches "ready" (wait on a real DOM signal, not a fixed sleep);
   - open **Try a Deck**, pick a deck, and confirm the chart, the radar and the main panels render;
   - paste a short decklist into the main input and confirm it analyses;
   - fail on any `console.error` or uncaught page error (allow-list known third-party noise explicitly, with a
     comment explaining each entry).
3. Block or stub real network calls that make the test flaky or hit third parties (Firestore writes, Scryfall
   images). Anonymous Firebase init may stay if it is harmless; say what you chose.
4. Script `npm run e2e`. Keep it **out of** `npm run check` (needs a browser). Document it in `CLAUDE.md`.

## Out of scope

Sign-in, pods and gatherings flows (later, with the emulator). Any app code change. If a selector is hard to target,
prefer role/text selectors over adding attributes.

## Done when

`npm run e2e` passes 3 runs in a row locally, and fails if you break the chart render on purpose.
