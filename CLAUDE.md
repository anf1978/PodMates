# PodMates

Commander (MTG) playgroup companion: deck analysis ("Deck Chart"), pod social features (MyPods) and the PriceScry
price tool. Static web app (Vite + TypeScript) on GitHub Pages; Firebase Auth/Firestore; data built by GitHub
Actions. `index.html` is static markup and CSS; all behaviour is typed modules in `src/`, wired together in
`src/app/`. Nothing is published on `window`.
Full context: [docs/overview.md](docs/overview.md) · Architecture: [docs/architecture.md](docs/architecture.md) ·
Terms: [docs/glossary.md](docs/glossary.md) · Plan: [docs/refactor-plan.md](docs/refactor-plan.md) ·
Deploy: [docs/deploy.md](docs/deploy.md) · Decisions (Proposed until human agreement):
[D1](docs/adr/0001-development-workflow.md), [D2](docs/adr/0002-ui-approach.md),
[D3](docs/adr/0003-pricescry-location.md), [D4](docs/adr/0004-hosting.md),
[D5](docs/adr/0005-generated-data.md), [D6](docs/adr/0006-history-rewrite.md),
[D7](docs/adr/0007-typescript-strictness.md).

## Commands

Node.js 22+. `npm ci` installs; `npx playwright install chromium` once for e2e (`--with-deps` on Linux CI).

- `npm run dev` / `npm run build` / `npm run preview` — Vite dev server, production `dist/`, serve the build.
- `npm run check` — typecheck + lint + unit + golden tests. **Must pass before you say you're done.**
- `npm run test:rules` — Firestore emulator tests (Java 21+), separate from `check`; no rules deployment.
- `npm run build && npm run budget` — gzip code + boot-data ratchet (also CI and post-assembly deploy).
  Interim limits and the unmet plan §10 target are documented in `docs/deploy.md`.
- `npm run e2e` — Playwright (Chromium). Most specs run on an isolated build preview (port 4183); the
  `*.modules.spec.ts` specs run on a Vite dev server (port + 1) and reach the page's modules with
  `withModules()` (`tests/e2e/modules.ts`) for flows that have no signed-out UI. Set `PM_E2E_PORT` to a free
  port when another session is testing. Not part of `check`.
- `npm run typecheck`, `npm run lint`, `npm test` — one check at a time.
- `npm run golden` — engine snapshots for all 178 sample decks. `npm run golden:update` **only** when an engine
  change is intended (use `/engine-change`; explain the diff in the PR). `npm run golden:fixture` re-pins
  fixtures from local data; run it only deliberately.
- `npx prettier --write <files>` on the files you changed. Not `npm run format` (reformats unrelated files),
  and never on `index.html`.

CI runs `check` + e2e + rules tests on every PR (including stacked bases) and `main`; see `.github/workflows/{ci,deploy}.yml`.

## Map

- `index.html` — markup, main CSS and two script tags: `src/main.ts` and the theme pre-paint placeholder (the
  build inlines `src/features/themes/prepaint.ts`, which must run before first paint).
  `tests/static-shell.test.ts` rejects inline scripts and inline event handlers.
- `src/main.ts` — the one module entry: imports `src/app/` in order, then installs the global error handlers and
  the sticky-Close net and mounts notifications.
- `src/app/` — the **composition root**, and the only code that wires features to each other. `page.ts` boots
  the card data and its loading bar and mounts the deck form and mode tabs; one module per feature supplies that
  feature's ports. `battle.ts` (current battle + compared decks), `mode.ts` (Deck Chart / MyPods tabs),
  `active-pod.ts` and `analysis.ts` are the shared cross-feature pieces. Import order is behaviour (listener order).
- `src/engine/` — pure scoring/analysis. No DOM, network or globals. Read [src/engine/CLAUDE.md](src/engine/CLAUDE.md).
- `src/cards/` — card tuples (`tuple.ts`), DB worker + codec, lookup, decklist parser, ranked name search (`search.ts`).
- `src/data/` — curated tables (`combos.ts`, `game-changers.ts`, …) and the dataset loader (`load-dataset.ts`).
- `src/services/` — shared state and behaviour below the features:
  - `card-data.ts` — the card DB, lookup indexes, Spellbook, win-rates, tags, lazy deck library and knowledge,
    `pageContext()` and the ranked card search; `card-db-boot.ts` loads them; `boot-status.ts` owns the loading bar.
  - `deck-form.ts` — Deck Name auto-naming state and the imported deck link; `current-chart.ts` — the deck on the
    Deck Chart (`runChart()` charts the form's deck).
  - `events.ts` — the typed event bus between features; `report-error.ts` — the redacted error sink
    (`reportError(error, { operation, userTriggered })`; preserve rejection/return contracts).
  - `cloud/` — the **only** place that talks to Firebase; one repository per Firestore area; `limits.ts` holds
    `PM_LIMITS`.
  - Also `deck-analysis`, `reference-data`, `saved-decks`, `deck-rows`, `linked-duplicates`, `decklist-limits`,
    `deck-editing`, `card-art`, `scryfall`, `price-data`, `trade-ledger`, `safe-url` and `pwa` (bounded SW
    registration; Workbox config is in `vite.config.js`; `scripts/sw-kill-switch.js` is the emergency replacement).
- `src/ui/` — shared primitives: `html.ts` (lit-html), modal, `tad-modal.ts` overlays, confirm, info dialog, toast,
  status, tooltip, tabs, radar, mana symbols, card search list, decks table, sticky Close.
- `src/styles/` — `tokens.css` (CSS variables) and `base.css`.
- `src/features/<name>/` — one folder per user-facing area: `index.ts` (mount + ports), `state.ts`, `view.ts` /
  `panels/`, `<name>.css`, `*.test.ts`. Features: `deck-chart`, `deck-form`, `try-a-deck`, `export`, `scan-cards`,
  `deck-crafter`, `card-viewer`, `saved-decks`, `auth`, `profile`, `pods`, `gatherings`, `chronicles`, `impact`,
  `spoiler-bait`, `trades`, `ledger`, `comparison`, `notifications`, `themes`, `pricescry` (lazy chunk; read
  [src/features/pricescry/CLAUDE.md](src/features/pricescry/CLAUDE.md)). What each owns: `docs/architecture.md`.
- `public/data/` — committed dataset snapshots (generated); `public/` — icons and manifest.
- `pipelines/` — typed Node data builders and shared helpers run by Actions; see `pipelines/README.md`.
- `.github/actions/scryfall-bulk/` — shared current-export download/cache; all Scryfall bulk workflows use it.
  Actions are SHA-pinned and Dependabot maintains Actions/npm updates.
- `firebase/` — unchanged Firestore rules, emulator-only config and rules tests; read `firebase/CLAUDE.md`.
- `tests/golden/` (engine snapshots) · `tests/e2e/` (Playwright) · `scripts/` (build, lint and manifest tools).

`tests/e2e/accessibility.spec.ts` enforces axe serious/critical findings on the deck form, Try-a-Deck,
expanded chart panels, info dialog and account screens. The one exact contrast deferral is documented in
`docs/architecture.md`; do not disable contrast globally or broaden it to new nodes/colours.

## Rules

1. **Stack, don't branch from `main`** while the refactor stack is open (`docs/prompts/00-README.md`). Open a
   PR; never push to `main`. One feature or fix per PR.
2. **No behaviour change unless asked:** no visual, score or data-model changes as side effects. Golden must stay
   byte-identical; intentional engine changes go through `/engine-change`.
3. **Never edit generated files** — `public/data/**`, `**/generated/**`, `*.generated.*`, anything with a
   `// GENERATED` header — not even through shell commands. Change the pipeline instead. Weekly bots publish
   `cards.json`, `tags.json` and `winrates.json` on the `data` branch and never edit source.
4. **Never change Firestore paths or field names** (`users/{uid}/…`, `pods/{podId}/…`). Real user data depends on them.
5. **Render with the `html` template from `src/ui/html.ts`.** `no-unsanitized` is an error everywhere with no
   sanitizer escape: never assign `innerHTML` with anything but a literal. Every `trustedHtml()` call needs a
   nearby `Trusted:` comment explaining its provenance.
6. **No globals or `window.*`, and no inline scripts in `index.html`.** Import what you need; lint rejects any
   `window`/`globalThis` write in `src/`.
7. **Layers:** features never import other features or `src/app`; services never import features or `src/app`.
   Cross-feature wiring goes in `src/app/` (ports) or through `src/services/events.ts`. Only `src/services/cloud`
   imports Firebase; only `src/ui/html.ts` imports lit-html.
8. **Keep files under ~400 lines** (lint errors at 500; curated `src/data` tables exempt). Split by responsibility.
9. **Styles:** CSS variables from `src/styles/tokens.css`; no inline `style=` except truly dynamic values.
10. **Edit `index.html` in place; never regenerate it.** It holds two huge single lines (the base64 favicon near
    the top and the header artwork `<img src="data:image/jpeg;base64` near `<header>`): grep for an id and do a
    ranged read rather than printing the file.
11. Update `CLAUDE.md` and `docs/architecture.md` when code moves. Never commit secrets (the Firebase web
    `apiKey` in `src/services/cloud/firebase.ts` is public by design).

## Gotchas

- **Card tuples are positional arrays.** Only `src/cards/tuple.ts` maps a position to a field (`n, t, o, c, ci, m,
p, r, pm, rt, pw, tg, x, ly, ob, bt`), matching `build-card-db.mjs`. Use its accessors, never `t[3]`; keep the
  length guards there for older DBs; never reorder or reuse a position.
- **Engine scores are calibrated** against a 224-deck reference corpus; changing `PATTERNS`, scoring or baselines
  moves every deck. Never as a side effect.
- **Pod "Impact card" edits only affect the separate "Pod view" line** under the radar, never the main scores.
- **The PriceScry password is a soft gate**, not security. Don't put anything sensitive behind it.
- PriceScry helpers `nameKey()`, `fnv1a()`, `shardOf()` are duplicated in `pipelines/lib/pricescry-lib.mjs` and
  `src/services/price-data.ts` (grep `KEEP IN SYNC`); change both or neither, or price shards stop resolving.
- `mana.ts` mirrors the `SHARED MANA-PRODUCTION LOGIC` block in `build-card-db.mjs`; `mana.test.ts` checks both.
- **`src/app/` import order is behaviour.** `main.ts` imports the wiring modules in the order the old page
  registered its listeners (page-wide delegates first, MyPods last). Don't make one wiring module import another
  that mounts something; shared pieces (`battle.ts`, `active-pod.ts`, `mode.ts`, `analysis.ts`) have no side effects.
- **lit renders append:** rendering into an element that still holds static markup keeps that markup; clear it
  once first (see `services/boot-status.ts`).
- **CPU-bound tests must yield.** Vitest's worker RPC times out after 60 s and replies are only read in the
  event loop's poll phase, so a long synchronous stretch fails the run with `Timeout calling "onTaskUpdate"`
  even when every test passes. Use `await yieldToEventLoop()` (`pipelines/pricescry/yield-to-event-loop.mjs`)
  between simulations; a single `setImmediate` does not reach the poll phase.
- **Be polite to external APIs:** Scryfall, Playgroup.gg and tcgcsv rate-limit and asked for identified traffic —
  keep the User-Agent headers and delays in `pipelines/` and the workflows.
- **lit text runs:** keep each rendered text run one interpolation (`` html`${pct}%` `` is two text nodes and shifts
  Chrome's layout by a hundredth of a pixel). Feature CSS is a `<link>` in `index.html` **and** an entry in
  `vite.config.js`'s stylesheet loop.
- Close overlays with `closeTryADeckModal()` / `closeModal(el)`, not `el.remove()`; set width via
  `modalStyle`, not `style.cssText`.

## Claude workspace

`.claude/commands/` supplies `/check`, `/new-feature <name>` and `/engine-change`. There are no hooks: run Prettier
on changed files and `npm run check` yourself before finishing, and paste the result in the PR. `.claude/settings.json`
also denies the generated-path patterns to Claude's Edit/Write tools. CI is the real gate.
