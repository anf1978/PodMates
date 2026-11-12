# Session p4-4 — Accessibility pass and central error reporting

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` Phase 4.

## Task

1. **Accessibility:** run axe (`@axe-core/playwright`) on the main views covered by e2e (chart, Try-a-Deck, a modal,
   sign-in, a pod view if covered). Fix serious/critical issues without visual changes: labels, button vs div,
   focus order/visibility, dialog roles, colour contrast **only** where tokens allow a non-visible fix (otherwise
   list for design). Then make axe serious/critical violations fail e2e.
2. **Errors:** `src/services/report-error.ts` with `reportError(err, context)`: logs a consistent console line, and
   shows a user-facing toast for user-triggered failures. Hook `window.onerror` and `unhandledrejection`. Replace
   ad-hoc `console.error` + `alert` patterns in `src/**` with it. Leave a single place to plug in a remote reporter
   later; do **not** add a third-party service.
3. Network calls in services (Firestore, Scryfall, Worker) surface failures through `reportError` instead of failing
   silently.

## Done when

`npm run check` + `npm run e2e` green with axe enforced; the PR lists fixed and deferred a11y issues.
