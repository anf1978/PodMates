# PodMates

Commander (MTG) playgroup companion: deck analysis ("Deck Chart"), pod social features (MyPods) and the PriceScry
price tool. Static web app (Vite + TypeScript) on GitHub Pages; Firebase Auth/Firestore; data built by GitHub
Actions. **Mid-migration:** typed code lives in `src/`, but the remaining UI is still inline in `index.html` (~1,800
lines), reached through strangler shims.
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
- `npm run e2e` — Playwright (Chromium) on an isolated preview at port 4183; set `PM_E2E_PORT` to a free port
  when another session is testing. Not part of `check`.
- `npm run typecheck`, `npm run lint`, `npm test` — one check at a time.
- `npm run golden` — engine snapshots for all 178 sample decks. `npm run golden:update` **only** when an engine
  change is intended (use `/engine-change`; explain the diff in the PR). `npm run golden:fixture` re-pins
  fixtures from local data; run it only deliberately.
- `npx prettier --write <files>` on the files you changed. Not `npm run format` (reformats unrelated files),
  and never on `index.html`.

CI runs `check` + e2e + rules tests on every PR (including stacked bases) and `main`; see `.github/workflows/{ci,deploy}.yml`.

## Map

- `src/main.ts` — the page's one module entry: imports the shims in order (UI, feature adapters, engine, limits,
  profile, auth, gatherings, chronicles, saved decks, cloud, pods), installs the sticky-Close net and
  mounts notifications.
- `src/engine/` — pure scoring/analysis. No DOM, network or globals. Read [src/engine/CLAUDE.md](src/engine/CLAUDE.md).
- `src/cards/` — card tuples (`tuple.ts`), DB worker + codec, lookup, decklist parser, ranked name search (`search.ts`).
- `src/data/` — curated tables (`combos.ts`, `game-changers.ts`, …) and the dataset loader (`load-dataset.ts`).
- `src/services/cloud/` — the **only** place that talks to Firebase; one repository per Firestore area.
- `src/services/report-error.ts` — central redacted error sink, user-action toast and global error listeners.
  Use `reportError(error, { operation, userTriggered })`; preserve rejection/return contracts.
- `src/services/scryfall.ts` — shared Scryfall JSON requests; `card-art.ts` — on-demand card images (memory cache).
- `src/services/events.ts` — typed navigation, active-pod, trade and chart events; adapters bridge unmoved consumers.
- `src/services/deck-analysis.ts` — shared decklist analysis for comparison, profiles and saved-deck tables.
- `src/services/reference-data.ts` — the reference set, baselines and lazy precon fingerprints the chart and
  comparison compare against (maths in `src/engine/{reference,benchmarks}.ts`).
- `src/services/current-chart.ts` — the deck on the Deck Chart now; Impact, export and the viewers read it.
  `runChart()` charts the form's deck for other boundaries (Deck Chart registers the runner).
- `src/services/saved-decks.ts` — in-memory mirrors of your saved decks and podmates' shared ones (refresh,
  retry, backup merge); `linked-duplicates.ts` hides a linked mirror of a saved deck; `deck-rows.ts` scores
  decks for the comparison tables; `decklist-limits.ts` is the friendly decklist-size check.
- `src/services/card-db-boot.ts` — required datasets, card-DB boot and optional Spellbook decode/timeout;
  one dynamic entry owns orchestration, with global assignments and boot UI still in the inline adapter.
- `src/services/trade-ledger.ts` — shared lot accounting and current lots/marks for Ledger and trade dialogs.
- `src/services/price-data.ts` — PriceScry's published data: cached fetches, shard helpers, yen and consensus prices.
- `src/services/pwa.ts` — bounded initial SW registration and opt-in update prompt; Workbox config lives in
  `vite.config.js`. `scripts/sw-kill-switch.js` is the documented emergency replacement, not a normal asset.
- `src/ui/` — shared primitives: `html.ts` (lit-html), modal, info dialog (`info-modal.ts`), toast, status, tooltip, tabs, radar, mana symbols,
  the card search list (`card-search.ts`/`.css`; the caller supplies ranking and the card DB).
  `tad-modal.ts` / `tad-modal.css` own the shared base/stacked dialogs, formerly injected by Try-a-Deck;
  `confirm.ts` the Delete/action confirms, `sticky-close.ts` the pinned-Close safety net (installed by
  `main.ts`) and `decks-table.ts`/`.css` the sortable saved-decks table (Build Table and My Profile).
- `src/styles/` — `tokens.css` (CSS variables) and `base.css`.
- `src/features/<name>/` — one folder per feature: `state.ts`, `view.ts`/`panels/`, `<name>.css`, `*.test.ts`.
  Moved: `deck-chart` (four panels), `try-a-deck`, `export`, `scan-cards`, `deck-crafter`, `auth`, `profile`,
  `pods`, `gatherings`, `chronicles`, `impact`, `spoiler-bait`, `trades`, `notifications`, `ledger`, `comparison`,
  `themes`, `pricescry`, `card-viewer` and `saved-decks`.
  Adapters supply the still-inline deck form, shared library gate and analysis. Scan and Deck Crafter communicate through
  `src/services/deck-editing.ts`; features never import each other or read legacy globals directly.
  Saved Decks owns Save Deck (name-collision choice, keep-synced link), Load a Deck (own and podmates' decks,
  secret/delete, Gathering seats via `decks:pick`) and Build Table; Deck Crafter saves via `decks:save`.
  Profile includes My Profile, linked decks, My Data backup/restore,
  quick summaries and public player/pod profiles; its runtime ports bridge the remaining inline card DB,
  deck form, mode switch, display settings and account guard. Pods owns landing, membership, settings and invite consent.
  Gatherings owns host/lineups, RSVP, landing cards, waiting/live trays and sample tables; its runtime
  ports adapt the remaining comparison, battle/Chronicles controls and saved-deck picker.
  `src/services/events.ts` connects independent features without feature imports.
  Chronicles owns the grouped journal, entry permissions/notes/deletion/clear and optional post-battle feedback;
  Chronicle snapshot construction, Log/Repeat/New Battle controls and result watching also live there.
  Its adapter retains only existing journal-refresh/render and battle-control/watch names.
  Impact owns the list/reasons, nominations/ideas, lazy candidates and separate Pod view; its adapter only
  supplies the library gate and search, and the radar caption mounts on the `chart:radar` event. Standard scores never use pod proposals.
  Card viewer owns View Deck, the type galleries, single-card art and commander portraits; its adapter binds the
  View Deck button and keeps two names for the delegated card/type click handler; the commander portraits
  follow the `chart:commanders` event.
  `deck-chart/interactions/` owns the Synergy panel's interaction reading (packages and plans, display only) and
  the "Cards you could add" sheet. `deck-chart/report.ts` renders Key Pieces & Combos, Synergy, Track Record and
  Centrality, and `explainers/` owns every "How was this built?" dialog plus the delegated explain/Game Changer
  clicks. `index.ts` binds Chart Deck, `run-analysis.ts` charts a deck and `results/` renders Win Condition,
  Closest Match, Table Vibe, the radar area, Bracket, not-found and the legality dialog. The adapter passes the
  card DB, tags, knowledge and deck-form helpers in, registers `runChart`, and keeps `hasChartResult` for the
  inline `setMode`.
  Spoiler Bait owns swipe/filter/votes/lists and the pod board; its only shim is `sbMount` for the PriceScry
  adapter, which passes signals, day, pod and card-navigation callback explicitly.
  Trades owns purchase/edit, price checks, sales/edit/removal, deletion and CSV export.
  Prices come from `services/price-data`; typed trade events connect Ledger and PriceScry.
  Notifications owns the in-app bell, merged activity feed and per-account device preferences. It uses
  typed pod-membership/navigation events and direct repositories; no notification globals remain.
  Ledger owns filters, P&L totals and open/closed lots; `psRenderLedger` stays only for the PriceScry adapter.
  Comparison owns Rule Zero, alignment/nudges, rankings, axes, pace and mini radars and deck details.
  Its adapter supplies shared analysis inputs, lazy datasets and the existing battle-result state.
  Themes owns the colour themes, text size and Display settings tray. `prepaint.ts` is bundled to a classic
  script and inlined into `<head>` by `scripts/theme-prepaint.mjs` (it must run before first paint, so it is not a
  module); only `renderDisplaySettings` stays as a shim for the profile adapter.
  PriceScry is a lazy chunk (screen, gate, views) behind a small eager `index.ts`; profile opens it with
  `pricescry:open`. Read [src/features/pricescry/CLAUDE.md](src/features/pricescry/CLAUDE.md) (data branch,
  shard format, soft gate, KEEP-IN-SYNC helpers).
- `**/legacy-globals.ts`, `src/services/cloud/{index,limits-global}.ts` — strangler shims publishing typed code
  on `window` for the inline scripts. Delete each name with its last inline caller.
- `index.html` — markup, main CSS and the inline legacy scripts (everything not yet in `src/features`).
- `public/data/` — committed dataset snapshots (generated); `public/` — icons and manifest.
- `pipelines/` — typed Node data builders and shared helpers run by Actions; see `pipelines/README.md`.
- `.github/actions/scryfall-bulk/` — shared current-export download/cache; all Scryfall bulk workflows use it.
  Actions are SHA-pinned and Dependabot maintains Actions/npm updates.
- `firebase/` — unchanged Firestore rules, emulator-only config and rules tests; read `firebase/CLAUDE.md`.
- `tests/golden/` (engine snapshots) · `tests/e2e/` (Playwright) · `scripts/` (extraction/manifest tools).

`tests/e2e/accessibility.spec.ts` enforces axe serious/critical findings on the deck form, Try-a-Deck,
expanded chart panels, info dialog and account screens. The one exact contrast deferral is documented in
`docs/architecture.md`; do not disable contrast globally or broaden it to new nodes/colours.

## Rules

1. **Stack, don't branch from `main`.** Refactor sessions follow `docs/prompts/00-README.md`. Open a PR; never
   push to `main`. One feature or fix per PR.
2. **No behaviour change unless asked:** no visual, score or data-model changes as side effects. Golden must stay
   byte-identical; intentional engine changes go through `/engine-change`.
3. **Never edit generated files** — `public/data/**`, `**/generated/**`, `*.generated.*`, anything with a
   `// GENERATED` header — not even through shell commands. Change the pipeline instead. Weekly bots publish
   `cards.json`, `tags.json` and `winrates.json` on the `data` branch and never edit source.
4. **Never change Firestore paths or field names** (`users/{uid}/…`, `pods/{podId}/…`). Real user data depends on them.
5. **Render with the `html` template from `src/ui/html.ts`.** `no-unsanitized` is an error in modules and
   inline HTML scripts. Legacy rich markup goes through `sanitizeHtml` (DOMPurify); still escape text with
   `escapeHtml(…)`. Every `trustedHtml()` call needs a nearby `Trusted:` comment explaining its provenance.
6. **No new globals or `window.*`.** Import what you need. Lint allows `window` writes only in the shims and the
   boot-bar progress in `load-dataset.ts`.
7. **Features don't import other features;** share through `src/ui`, `src/engine`, `src/cards` or services.
   Only `src/services/cloud` imports Firebase; only `src/ui/html.ts` imports lit-html.
8. **Keep files under ~400 lines** (lint errors at 500; curated `src/data` tables exempt). Split by responsibility.
9. **Styles:** CSS variables from `src/styles/tokens.css`; no inline `style=` except truly dynamic values.
10. **Never regenerate or re-upload the whole `index.html`.** Edit only the lines you need.
11. Update `CLAUDE.md`, `docs/architecture.md` and the line map when code moves. Never commit secrets (the
    Firebase web `apiKey` in `src/services/cloud/firebase.ts` is public by design).

## Working in `index.html`

- **Never read or print the whole file**, nor the huge lines below. Grep for the **identifier**, then do a ranged
  read; cap grep width (`grep -n … | cut -c1-200`). Line numbers drift with every edit.
- Inline scripts share **one global scope**: grep before renaming or adding a top-level name. Cross-script
  contracts: `window.PodmatesCloud`, `window.PM_LIMITS`, `window.pmUi`, `window.__dbReady`,
  `window.__dbLoadPct` and the `podmates-cloud-init` event.
- Modules (`src/main.ts`) run after parsing: inline code must not call shim names or read `window.PM_LIMITS`
  during parsing, and must wait for `podmates-cloud-init` before using the cloud.

| ~Line | Huge single line — do not print                 |  Size |
| ----: | ----------------------------------------------- | ----: |
|    13 | `<link rel="icon"` (inline base64 PNG)          | 11 KB |
|  1117 | `<img src="data:image/jpeg;base64` (header art) | 25 KB |

### Line map (approximate — always re-grep the identifier)

|     ~Line | Region                                                                                 | Identifier to grep                                                                   |
| --------: | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
|      5–11 | CSP, synchronous sanitizer dependency and legacy boundary                              | `Content-Security-Policy`, `rendering-security-script`                               |
|        48 | Module entry                                                                           | `src="./src/main.ts"`                                                                |
|    49–971 | Main CSS (Terraria × MTG Arena theme at ~436)                                          | `<style>` (first one), `Terraria x MTG Arena theme`                                  |
|       972 | Theme pre-paint placeholder (inlined at build/serve time)                              | `id="theme-script"`, `src/features/themes/prepaint.ts`                               |
|  984–1105 | Visual overhaul CSS                                                                    | `<style id="pm-visual-overhaul">`                                                    |
| 1107–1361 | `<body>` markup: auth bar anchor, header, mode tabs, deck form                         | `id="authBar"`, `<header>`, `class="mode-tabs"`                                      |
| 1124–1166 | Card-DB progress + progress-stall watchdog                                             | `dbLoadFill`, `window.__dbProgress`                                                  |
|      1270 | Result panels markup                                                                   | `id="resultsSection"`                                                                |
|      1359 | Footer data freshness                                                                  | `dataFreshness`                                                                      |
| 1362–1390 | Engine/lookup/card-DB/Spellbook page bindings                                          | `<script id="engine-script">`, `lookup-script`, `data-script`, `combo-data-script`   |
| 1391–1758 | **App script** (UI + all unmoved features)                                             | `<script id="app-script">`                                                           |
|      1400 | Try-a-Deck library global (filled by `loadDeckLibrary`)                                | `let TRY_A_DECK_OPTIONS;`                                                            |
|   modules | Reference set, percentiles, closest precon, staples/mana-base benchmarks               | `src/engine/{reference,benchmarks}.ts`, `src/services/reference-data.ts`             |
| 1433–1510 | Card-DB boot adapter, data globals and lazy dataset gates                              | `const cardDbBoot`, `const KNOW_MAP`, `loadKnowledge`, `initDatabase`                |
|   modules | Card-DB/Spellbook boot, required datasets and timeout                                  | `src/services/card-db-boot.ts`                                                       |
|      1520 | Size-limit wiring (values in `src/services/cloud/limits.ts`)                           | `---- Size limits`, `PM_INPUT_LIMIT_KEYS`                                            |
|   modules | Chart Deck: form → analysis → every result panel; current chart state                  | `src/features/deck-chart/{index,run-analysis}.ts`, `src/services/current-chart.ts`   |
|   modules | Result panels: win-con, closest match, table vibe, radar, bracket, not-found, legality | `src/features/deck-chart/results/`                                                   |
|   modules | Key Pieces, Synergy, Track Record, Centrality, explainers                              | `src/features/deck-chart/report.ts`, `{key-pieces,synergy,centrality,explainers}/`   |
|   modules | Confirm dialogs and the sticky-Close safety net                                        | `src/ui/{confirm,sticky-close}.ts`                                                   |
|   modules | Sign in / sign up, account bar and save guard                                          | `src/features/auth/{index,view,state}.ts`                                            |
|   modules | My Profile, linked decks and public player/pod profiles                                | `src/features/profile/`; temporary ports in `legacy-globals.ts`                      |
|   modules | Chronicles history, notes, feedback, battle controls/watch                             | `src/features/chronicles/{index,view,dialogs,state,battle,battle-view,watch}.ts`     |
|   modules | PriceScry (gate, Search/card, Movers, Signals, Radar, planner)                         | `src/features/pricescry/` (lazy chunk), `src/services/price-data.ts`                 |
|   modules | Spoiler Bait swipe, votes, lists and pod board                                         | `src/features/spoiler-bait/{index,state,view,data,gestures}.ts`                      |
|   modules | Colour themes, text size and Display settings tray                                     | `src/features/themes/{palette,apply,prepaint,view,index}.ts`                         |
|      1252 | MyPods mount point (implementation in `src/features/pods`)                             | `MyPods mounts here`                                                                 |
|   modules | Gatherings (host, RSVP, seats, live and sample)                                        | `src/features/gatherings/{index,host,waiting,view,landing,watch}.ts`                 |
|   modules | Impact cards + "Pod view" line                                                         | `src/features/impact/{index,state,view,repository}.ts`                               |
|   modules | Trade purchase, price check, sale actions and CSV                                      | `src/features/trades/{index,state,view,csv}.ts`                                      |
|   modules | Try-a-Deck, export and scan cards                                                      | `src/features/{try-a-deck,export,scan-cards}/index.ts`                               |
|   modules | Card art, View Deck, type galleries, commander portraits                               | `src/services/card-art.ts`, `src/features/card-viewer/`                              |
|   modules | Interaction packages/plans, "Cards you could add" sheet                                | `src/features/deck-chart/interactions/{reading,packages,suggestions,sheet}.ts`       |
|   modules | Shared modal overlay + close                                                           | `src/ui/tad-modal.ts`, `src/ui/tad-modal.css`                                        |
|   modules | Ledger filters, P&L totals, open/closed lots and trade events                          | `src/features/ledger/{index,state,view}.ts`                                          |
|   modules | Pod Comparison, balance guidance, charts and deck details                              | `src/features/comparison/{index,state,guidance,view,balance-view,charts,detail}.ts`  |
|   modules | Save Deck, Load a Deck (also for Gathering seats) and Build Table                      | `src/features/saved-decks/{index,save,load-deck,load-deck-view,table}.ts`            |
|   modules | Deck Crafter (deck builder)                                                            | `src/features/deck-crafter/index.ts`, `src/services/deck-editing.ts`                 |
|   modules | Saved/podmate deck caches, linked-mirror de-duplication, table rows                    | `src/services/{saved-decks,linked-duplicates,deck-rows}.ts`, `src/ui/decks-table.ts` |
|   modules | My Data backup/restore                                                                 | `src/features/profile/backup.ts`                                                     |
|   modules | Notifications inbox, bell and device preferences                                       | `src/features/notifications/{index,state,storage,view}.ts`                           |

Updated for R14 slice 7 (remaining ranges approximate). Regenerate with:

```sh
grep -n -E '<script|</script>|<style|</style>|<body' index.html | cut -c1-120          # block boundaries
awk 'length > 3000 { print NR": "length" chars: "substr($0,1,50) }' index.html          # huge lines
grep -n -E '^\s*(//|/\*|<!--)\s*[=─-]{8,}' -A1 index.html | cut -c1-120                 # section banners
grep -n -E '^\s*(async\s+)?function\s+\w+\s*\(' index.html | cut -c1-100                # functions
```

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
- **CPU-bound tests must yield.** Vitest's worker RPC times out after 60 s and replies are only read in the
  event loop's poll phase, so a long synchronous stretch fails the run with `Timeout calling "onTaskUpdate"`
  even when every test passes. Use `await yieldToEventLoop()` (`pipelines/pricescry/yield-to-event-loop.mjs`)
  between simulations; a single `setImmediate` does not reach the poll phase.
- **Be polite to external APIs:** Scryfall, Playgroup.gg and tcgcsv rate-limit and asked for identified traffic —
  keep the User-Agent headers and delays in `pipelines/` and the workflows.
- **lit text runs:** keep each rendered text run one interpolation (`` html`${pct}%` `` is two text nodes and shifts
  Chrome's layout by a hundredth of a pixel). Feature CSS is a `<link>` in `index.html` **and** an entry in
  `vite.config.js`'s stylesheet loop; a new build entry goes in both lists there.
- Close overlays with `closeTryADeckModal()` / `pmUi.closeModal(el)`, not `el.remove()`; set width via
  `modalStyle`, not `style.cssText`.

## Claude workspace

`.claude/commands/` supplies `/check`, `/new-feature <name>` and `/engine-change`. There are no hooks: run Prettier
on changed files and `npm run check` yourself before finishing, and paste the result in the PR. `.claude/settings.json`
also denies the generated-path patterns to Claude's Edit/Write tools. CI is the real gate.
