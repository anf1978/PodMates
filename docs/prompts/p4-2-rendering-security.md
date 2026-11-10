# Session p4-2 — Rendering and input security pass

Follow the session rules in `docs/prompts/00-README.md`. Context: `docs/refactor-plan.md` Phase 4 (security pass),
`docs/overview.md` §5.

## Task

1. Lint: ban `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` with non-literal values (`no-unsanitized`
   as error, plus `no-restricted-properties` where needed). Every `trustedHtml()` use must have a comment that
   explains why the input is trusted; review each one.
2. Audit every place untrusted text reaches the DOM or a URL: deck names, player names, pod/gathering names, notes,
   card names from imports, Moxfield/Archidekt data, Scryfall responses, URL params. Check `href`/`src` built from
   user data (block `javascript:` URLs).
3. If the Worker source is in the repo (`workers/deck-sync/`): review input validation (allowed hosts/paths, size
   limits, CORS origin, method allow-list, no open proxy) and add tests. If it isn't, list the review as a follow-up.
4. Add a Content-Security-Policy `<meta>` that the app passes (allow-list only the origins it actually uses: Firebase,
   Scryfall, the Worker, the `pricescry-data` raw host). Verify with e2e that there are no CSP violations.
5. Fix findings with minimal, behaviour-preserving changes. Anything needing a product decision → PR "Follow-ups".

## Done when

`npm run check` + `npm run e2e` green; the PR includes a findings table (location, issue, fix/deferred).
