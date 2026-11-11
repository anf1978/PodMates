# PodMates

Commander (MTG) playgroup companion: deck analysis ("Deck Chart"), pod social features (MyPods) and the PriceScry
price tool. Static web app (Vite + TypeScript) on GitHub Pages; Firebase Auth/Firestore; data built by GitHub
Actions. **Mid-migration:** typed code lives in `src/`, but most UI is still inline in `index.html` (~13,100
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

- `src/main.ts` — the page's one module entry: imports the shims in order (UI, Deck Chart, engine, limits, cloud).
- `src/engine/` — pure scoring/analysis. No DOM, network or globals. Read [src/engine/CLAUDE.md](src/engine/CLAUDE.md).
- `src/cards/` — card tuples (`tuple.ts`), DB worker + codec, lookup, decklist parser.
- `src/data/` — curated tables (`combos.ts`, `game-changers.ts`, …) and the dataset loader (`load-dataset.ts`).
- `src/services/cloud/` — the **only** place that talks to Firebase; one repository per Firestore area.
- `src/ui/` — shared primitives: `html.ts` (lit-html), modal, toast, status, tooltip, tabs, radar, mana symbols.
- `src/styles/` — `tokens.css` (CSS variables) and `base.css`.
- `src/features/<name>/` — one folder per feature: `state.ts`, `view.ts`/`panels/`, `<name>.css`, `*.test.ts`.
  Only `deck-chart` (four panels) has moved so far.
- `**/legacy-globals.ts`, `src/services/cloud/{index,limits-global}.ts` — strangler shims publishing typed code
  on `window` for the inline scripts. Delete each name with its last inline caller.
- `index.html` — markup, main CSS and the inline legacy scripts (everything not yet in `src/features`).
- `public/data/` — committed dataset snapshots (generated); `public/` — icons and manifest.
- `.github/scripts/` — Node data pipelines run by Actions (move to `pipelines/` in p5-1).
- `firebase/` — unchanged Firestore rules, emulator-only config and rules tests; read `firebase/CLAUDE.md`.
- `tests/golden/` (engine snapshots) · `tests/e2e/` (Playwright) · `scripts/` (extraction/manifest tools).

## Rules

1. **Stack, don't branch from `main`.** Refactor sessions follow `docs/prompts/00-README.md`. Open a PR; never
   push to `main`. One feature or fix per PR.
2. **No behaviour change unless asked:** no visual, score or data-model changes as side effects. Golden must stay
   byte-identical; intentional engine changes go through `/engine-change`.
3. **Never edit generated files** — `public/data/**`, `**/generated/**`, `*.generated.*`, anything with a
   `// GENERATED` header — not even through shell commands. Change the pipeline instead. Weekly bots publish
   `cards.json`, `tags.json` and `winrates.json` on the `data` branch and never edit source.
4. **Never change Firestore paths or field names** (`users/{uid}/…`, `pods/{podId}/…`). Real user data depends on them.
5. **Render with the `html` template from `src/ui/html.ts`.** Never assign `innerHTML` with interpolated data in
   `src/` (`no-unsanitized` is an error). In `index.html`, wrap user/pod text in `escapeHtml(…)`.
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
  contracts: `window.PodmatesCloud`, `window.pmNotif`, `window.PM_LIMITS`, `window.pmUi`, `window.__dbReady`,
  `window.__dbLoadPct` and the `podmates-cloud-init` event.
- Modules (`src/main.ts`) run after parsing: inline code must not call shim names or read `window.PM_LIMITS`
  during parsing, and must wait for `podmates-cloud-init` before using the cloud.

| ~Line | Huge single line — do not print                 |  Size |
| ----: | ----------------------------------------------- | ----: |
|     6 | `<link rel="icon"` (inline base64 PNG)          | 11 KB |
|  1384 | `<img src="data:image/jpeg;base64` (header art) | 25 KB |

### Line map (approximate — always re-grep the identifier)

|       ~Line | Region                                                       | Identifier to grep                                                                                     |
| ----------: | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
|          15 | Module entry                                                 | `src="./src/main.ts"`                                                                                  |
|     16–1069 | Main CSS (Terraria × MTG Arena theme at ~534)                | `<style>` (first one), `Terraria x MTG Arena theme`                                                    |
|   1070–1221 | Colour themes (runs in `<head>`)                             | `<script id="theme-script">`                                                                           |
|   1233–1367 | Visual overhaul CSS                                          | `<style id="pm-visual-overhaul">`                                                                      |
|   1369–1675 | `<body>` markup: auth bar, header, mode tabs, deck form      | `id="authBar"`, `<header>`, `class="mode-tabs"`                                                        |
|   1391–1430 | Card-DB progress + progress-stall watchdog                   | `dbLoadFill`, `window.__dbProgress`                                                                    |
|        1550 | Result panels markup                                         | `id="resultsSection"`                                                                                  |
|        1673 | Footer data freshness                                        | `dataFreshness`                                                                                        |
|   1676–1705 | Engine/lookup/card-DB/Spellbook page bindings                | `<script id="engine-script">`, `lookup-script`, `data-script`, `combo-data-script`                     |
|  1706–12915 | **App script** (UI + all unmoved features)                   | `<script id="app-script">`                                                                             |
|   1732–1940 | Reference corpus, percentiles, baselines, Try-a-Deck         | `REFERENCE_TIERS`, `STAPLES_BASELINE`, `let TRY_A_DECK_OPTIONS;`                                       |
|   1982–2110 | Card-DB/Spellbook loaders, eager/lazy dataset gates          | `decompressCardDB`, `loadStaticDatasets`, `loadDeckLibrary`, `loadKnowledge`, `initDatabase`           |
|        2126 | Size-limit wiring (values in `src/services/cloud/limits.ts`) | `---- Size limits`, `PM_INPUT_LIMIT_KEYS`                                                              |
|        2190 | Card art (Scryfall, on demand)                               | `CARD ART — fetched on demand`                                                                         |
|        2256 | Card lookup                                                  | `async function lookup(name)`                                                                          |
|        2316 | View Deck gallery                                            | `VIEW DECK — full visual gallery`                                                                      |
|        2573 | Chart request (calls the Deck Chart panels at ~2650)         | `async function runAnalysis`, `renderTypeTable(`, `renderLegality(`                                    |
|   2715–2849 | Result panels: win-con, radar chart, bracket                 | `function renderWinCondition`, `function renderChart(`, `function renderBracket`                       |
|        4375 | Synergy profile                                              | `function renderSynergyProfile`                                                                        |
|        4653 | Commander Centrality panel                                   | `function renderCommanderCentrality`                                                                   |
|        4962 | Sign in / sign up modal                                      | `SIGN IN / SIGN UP MODAL`                                                                              |
|        5106 | Profile builder (link Archidekt/Moxfield)                    | `PROFILE BUILDER`                                                                                      |
|   5210–6378 | **PriceScry** (Search, Movers, Radar, Ledger, trades)        | `PriceScry -- card price history`, `PRICESCRY_PW_SHA256`, `function psRenderRadar`                     |
|        5721 | Spoiler Bait                                                 | `SPOILER BAIT -- swipe`                                                                                |
|        6416 | My Profile modal                                             | `function renderProfileModal`                                                                          |
|        6877 | Pods (create/join, members, invites)                         | `PODS — create/join`                                                                                   |
|   7071–7992 | Gatherings (host, RSVP, seats, live)                         | `function runSampleGathering`, `function openHostGatheringOverlay`, `function renderLiveGatheringTray` |
|   8243–8610 | Impact cards + "Pod view" line                               | `IMPACT_LS_KEY`, `function openImpactCardsModal`                                                       |
|        8969 | Lazy Try-a-Deck entry point                                  | `async function showTryADeckModal`                                                                     |
|   9071–9088 | Shared modal overlay + Try-a-Deck close                      | `function openTadOverlay`, `function closeTryADeckModal`                                               |
|   9128–9387 | Scan cards (Tesseract OCR)                                   | `tesseractLoadPromise`, `function showScanCardsModal`                                                  |
|        9487 | Pod Comparison (up to 6 decks)                               | `POD COMPARISON`                                                                                       |
| 10024–10570 | Player / pod profile overlays                                | `function getPlayerRawDecksForProfile`, `function openPodProfileOverlay`                               |
|       10728 | Pod deck detail                                              | `async function showPodDeckDetail`                                                                     |
|       11003 | Saved data: decks, formations, chronicles                    | `SAVED DATA — decks`                                                                                   |
| 11123–11823 | Deck Crafter (deck builder)                                  | `Build a Deck: search-and-add`, `function openDeckBuilderOverlay`                                      |
|       12305 | My Data backup/restore                                       | `MY DATA — download/restore`                                                                           |
|       12400 | Retired pod rosters (dead code)                              | `POD ROSTERS -- retired`                                                                               |
| 12939–13086 | Notifications inbox                                          | `<script id="notif-script">`                                                                           |

Updated for P3-6. Regenerate with:

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
- PriceScry helpers `nameKey()`, `fnv1a()`, `shardOf()` are duplicated in `.github/scripts/pricescry-lib.mjs`
  (grep `helpers kept identical to`); change both or neither, or price shards stop resolving.
- `mana.ts` mirrors the `SHARED MANA-PRODUCTION LOGIC` block in `build-card-db.mjs`; `mana.test.ts` checks both.
- **Be polite to external APIs:** Scryfall, Playgroup.gg and tcgcsv rate-limit and asked for identified traffic —
  keep the User-Agent headers and delays in `.github/scripts/*` and the workflows.
- **lit text runs:** keep each rendered text run one interpolation (`` html`${pct}%` `` is two text nodes and shifts
  Chrome's layout by a hundredth of a pixel). Feature CSS is a `<link>` in `index.html` **and** an entry in
  `vite.config.js`'s stylesheet loop; a new build entry goes in both lists there.
- Close overlays with `closeTryADeckModal()` / `pmUi.closeModal(el)`, not `el.remove()`; set width via
  `modalStyle`, not `style.cssText`.

## Claude workspace

`.claude/commands/` supplies `/check`, `/new-feature <name>` and `/engine-change`. There are no hooks: run Prettier
on changed files and `npm run check` yourself before finishing, and paste the result in the PR. `.claude/settings.json`
also denies the generated-path patterns to Claude's Edit/Write tools. CI is the real gate.
