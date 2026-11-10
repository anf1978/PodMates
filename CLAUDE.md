# PodMates

Commander (MTG) playgroup companion: deck analysis ("Deck Chart"), pod social features (MyPods) and the PriceScry
price tool. Today the app is **one ~0.97 MB `index.html`** (HTML + CSS + inline JS), plus
datasets in `public/data/`, served by Vite.
Full context: [docs/overview.md](docs/overview.md) · Plan: [docs/refactor-plan.md](docs/refactor-plan.md)
Terms: [glossary](docs/glossary.md) · Decisions (Proposed until human agreement):
[D1](docs/adr/0001-development-workflow.md), [D2](docs/adr/0002-ui-approach.md),
[D3](docs/adr/0003-pricescry-location.md), [D4](docs/adr/0004-hosting.md),
[D5](docs/adr/0005-generated-data.md), [D6](docs/adr/0006-history-rewrite.md),
[D7](docs/adr/0007-typescript-strictness.md).

> **Interim file.** This describes the single-file app as it is now. It will be replaced by the target version
> (refactor plan, Appendix A) during Phase 3, once the code is split into `src/`.

## Commands

Use Node.js 22 or newer. Run `npm ci` to install the locked development dependencies.

- `npm run dev` — local Vite development server.
- `npm run build` — produce `dist/`; preserve inline scripts and substitute the bundled dataset loader URL.
- `npm run preview` — serve the production build locally (run the build first).
- `npm run check` — typecheck + lint + unit/golden tests; must pass before finishing a change.
- `npx playwright install chromium` — install the browser once after `npm ci` (`--with-deps` on Linux CI).
- `npm run e2e` — Chromium smoke tests; builds and starts an isolated Vite preview on port 4183.
  Set `PM_E2E_PORT` to a free port when another session is testing.
  Browser tests are deliberately excluded from `npm run check`.
- `npm run typecheck`, `npm run lint`, `npm test` — run an individual check.
- `npm run format` — Prettier; excludes `index.html`, data and lockfiles. Review diffs before committing.
- `npm run golden` — full analysis and all five axis snapshots for every embedded sample deck.
- `npm run golden:update` — intentionally accept reviewed engine output changes.
- `npm run golden:fixture` — regenerate pinned cards/Spellbook from local HTML/data files; proves full-data parity.

TypeScript is strict for new TypeScript; legacy JavaScript has `checkJs: false` and warn-only lint rules.
ESLint does not inspect inline HTML scripts yet.
Static icons and the web manifest live in `public/` and keep their original URLs in dev and production.
CI checks every PR (including stacked bases) and `main`; Pages builds/deploys and weekly-refresh
triggering are defined in `.github/workflows/{ci,deploy}.yml`. See [docs/deploy.md](docs/deploy.md)
for build-only validation, the human Pages source switch and rollback.

## Golden harness

`tests/golden/harness.ts` imports `src/engine` directly; there is no HTML extraction, `vm` or marker.
It builds an `EngineContext` from the pinned card, Spellbook and win-rate fixtures, and uses `src/cards`
for decklist parsing and lookup and `src/cards/db-codec.js` for card decoding. No app startup, DOM or
network runs. Sample decks come from `public/data/TRY_A_DECK_OPTIONS.json`; win-rates use the pinned
`tests/golden/fixtures/winrates.json`, never the weekly publication. `harness.test.ts` is the purity check:
every sample re-run with deep-frozen inputs, in reverse order, must give the same result. Fixture
regeneration reads the extracted
gzip/base64 Spellbook string, while ordinary golden tests keep using the pinned Spellbook fixture.

The current library has **178 decks** (the prompt's 174 predates four Star Trek decks). Fixtures pin 7,621 card
records and 3,397 Spellbook rows, including one-card-away combo candidates so the _whole_ analysis is preserved.
Ordinary golden/check runs never decode the live data blobs. Regenerate fixtures only deliberately, then review
the snapshot diff; weekly data refreshes must not automatically update this baseline. JSON object keys are sorted
recursively; array order and floating-point values are preserved without rounding.

## Browser smoke test

The smoke test in `tests/e2e/smoke.spec.ts` waits for the real DB-ready message, charts a Try-a-Deck sample,
checks the radar and populated panels, then analyses a pasted short list. The bundled Firebase SDK and the real cloud bridge run
signed out; `tests/e2e/offline.ts` fails any Firebase RPC, so no account is created and no Firestore traffic is sent. Scryfall art/API and Google Fonts are fulfilled locally;
all other external requests fail the test without leaving the browser. Console errors and uncaught page errors
always fail, with no noise allow-list. `@axe-core/playwright` is installed for later accessibility assertions.

### Claude workspace

Start Claude Code at the repository root with dependencies installed. Committed
`.claude/commands/` supplies `/check`, `/new-feature <name>` and `/engine-change`.
`.claude/settings.json` formats/lints each edited file (never `index.html`), and runs
`npm run check` on Stop.
A failed hook reports the error; fix it before finishing. See
[hook verification](.claude/hooks/README.md) for a manual session check.
Never hand-edit `public/data/**`, `**/generated/**`, `*.generated.*` or a file with
a `// GENERATED` header: update its pipeline. Permissions block the path patterns;
the pre-edit hook also checks existing headers and symlink targets. These guard
Edit/Write/NotebookEdit, not arbitrary shell commands; npm scripts and hooks are
trusted repository code, not a sandbox.

## Golden rules

1. **Start from the latest stack base.** Follow `docs/prompts/00-README.md` for refactor sessions.
   Weekly bots publish data separately and never rewrite application source.
2. **Never regenerate, re-download or re-upload the whole `index.html`.** Edit only the lines you need.
3. **Never edit `public/data/**` by hand.** Update the pipeline or reproduce an extraction instead.
   Weekly workflows publish validated `cards.json`, `tags.json` and `winrates.json` on the `data` branch;
   deploy copies them into `dist/data/` and records exact revision/hashes in `build-manifest.json`.
   Branch-dispatched rebuilds use `data-<source-branch>` instead, never production `data`.
   Committed snapshots support local development and CI without a data branch.
4. **Never change Firestore paths or field names** (`users/{uid}/…`, `pods/{podId}/…`). Real user data depends on them.
5. **Open a PR; never push to `main`.** One feature or fix per PR.
6. No behaviour change unless asked (no visual, score or data-model changes as side effects).
7. Never commit secrets. The Firebase web `apiKey` in `src/services/cloud/firebase.ts` is public by design.

## How to read `index.html`

- **Never read or print the whole file**, and never print the huge data lines (table below) — some are megabytes.
- Find things with grep, then do a ranged read (`view` with a line range, `sed -n 'A,Bp'`, etc.).
- Grep for the **identifier**, not the line number: line numbers drift with every edit.
- When grepping, cap the output width (e.g. `grep -n … | cut -c1-200`) so a match on a data line can't flood output.
- Scripts share **one global scope**: every top-level `function`/`const` is visible everywhere. Grep before
  renaming or adding a top-level name. Cross-script contracts: `window.PodmatesCloud`, `window.pmNotif`,
  `window.PM_LIMITS`, `window.__dbReady`, and the `podmates-cloud-init` event.

### Huge single-line data blobs still in HTML — do not print

| ~Line | Identifier (grep for this)                      |  Size | Managed by |
| ----: | ----------------------------------------------- | ----: | ---------- |
|     6 | `<link rel="icon"` (inline base64 PNG)          | 11 KB | hand       |
|  1450 | `<img src="data:image/jpeg;base64` (header art) | 25 KB | hand       |

### Typed card modules (`src/cards`)

`tuple.ts` owns the published tuple layout: a `CardTuple` type, a named accessor per position and
`cardFromTuple`, which `db-codec.js` uses instead of indexing a tuple. `lookup.ts` holds name normalisation,
`buildLookupIndexes`, `levenshtein`, `fuzzyFindCard`, `getCard` and `matchDecklist`; `parse-decklist.ts` holds
the decklist parser. `legacy-globals.ts` is the strangler shim: `initDatabase()` imports it before DB-ready and
it republishes those functions on `window` under their original names, so the inline scripts are unchanged.
ESLint keeps `src/cards` importing only its own files and `src/shared` (plus `src/data/load-dataset`, the one
documented exception until the p5-3 shared-code move). Each module is a Vite build entry, substituted into the
built HTML like the other loaders.

### Pure engine (`src/engine`)

`analyzeDeck` and everything it calls are strictly typed modules in `src/engine`; curated tables
(`HARD_COMBOS`, `SOFT_SYNERGIES`, `GAME_CHANGER_REASONS`, `DEFAULT_IMPACT_CARDS`) are in `src/data/*.ts`.
Engine inputs come through an explicit `EngineContext`; read [src/engine/CLAUDE.md](src/engine/CLAUDE.md)
before changing it. `src/engine/legacy-globals.ts` republishes the old global names on `window` with a
context built from `CARD_DB`, `SPELLBOOK_INDEX` and `COMMANDER_TIER_DATA`. It loads as a module tag after
`engine-script` and is also awaited by `initDatabase()`. ESLint keeps the engine pure (no page globals or
module-level `let`) and limits its imports to its own files, `src/cards`, `src/data` and `src/shared`.

### UI primitives (`src/ui`) and global styles (`src/styles`)

`src/ui/legacy-globals.ts` is loaded by a `<script type="module">` in `<head>`, so it runs after parsing and
before `DOMContentLoaded` (and before the Firebase module). It publishes the typed surface as `window.pmUi`
(`selectTab`, `tabsByAttribute`, `radarChartSvg`) and the original global names `showToast`, `setStatus`,
`setDeckMgmtStatus`, `setupIconTooltipsFor` and `ordinalSuffix`. Inline code must not call these during
parsing; the page-wide tooltip wiring waits for `DOMContentLoaded`. `renderChart` keeps its panel glue and
gets the SVG string from `radar-chart.ts`. `html.ts` re-exports lit-html; its `trustedHtml()` is the only
raw-markup path, and ESLint forbids importing lit-html anywhere else. `src/ui` may import only its own files and
`src/shared`. `src/styles/tokens.css` (the `:root` custom properties) and `base.css` (page-wide rules) are
linked before the first inline `<style>`, so the cascade is unchanged; the build emits them as hashed assets.

### Extracted hand-maintained datasets

`public/data/<CONSTANT>.json` holds `SPELLBOOK_SNAPSHOT_B64`, `KNOW_JSON`, `IMPACT_CANDS`,
`REFERENCE_SCORES`, `REFERENCE_TIERS`, `PRECON_FINGERPRINTS`, `STAPLES_BASELINE`, `MANABASE_BASELINE`
and `TRY_A_DECK_OPTIONS` (178 decklists). Spellbook keeps its exact gzip/base64 encoding inside a JSON string;
the other files contain their original runtime values. `scripts/extract-static-datasets.mjs` reproduces these
files from pre-extraction HTML; its optional `--replace-inline` flag performs the one-off declaration migration.

`src/data/load-dataset.ts` revalidates `data/manifest.json` first, then fetches relative to Vite's `BASE_URL`
with `?v=<sha256>`, caching promises and advancing the existing boot bar. Each manifest entry has `version`
(content hash prefix), ISO `generatedAt`, `sha256`, `bytes` and `source`. The footer shows card/win-rate dates
and quietly warns (text + console) when cards are over 14 days old. Extraction scripts and refresh pipelines
write metadata; deployment merges bot entries with static entries without resetting sibling dates.

`loadStaticDatasets()` keeps reference scores/tiers, staples/manabase baselines, tags and win-rates eager:
every complete analysis uses their percentile, benchmark, interaction or track-record data. Cards and Spellbook
also stay eager because scoring needs them; Spellbook keeps its existing optional fallback path.
Required boot failures use the boot error UI.

Optional bindings stay unset until their readers request them. `loadDeckLibrary()` loads/filter-checks
Try-a-Deck lists for the library, sample table and shared card-search rankings. First chart/pod-detail requests
use `loadAnalysisDatasets()` for fingerprints plus derived `TRY_A_DECK_METADATA`, never ordinary decklists.
Metadata retains validation lists only for announced decks so missing-card filtering is unchanged.
`loadKnowledge()` builds `KNOW_MAP` only when "Cards you could add" opens; Impact loads its candidates when
its modal opens. Existing loading UI stays visible while waiting; dismissed overlays cannot reappear.
Shared card searches await library rankings and discard superseded queries.

The same loader fetches `tags.json` and `winrates.json` before DB-ready, populating `IX_TAGS_JSON` / `IX_TAGS`
and `COMMANDER_TIER_DATA`. `src/cards/load-db.ts` starts `db.worker.ts` in parallel: the worker fetches
the manifest-versioned `cards.json` URL resolved on the main thread (unchanged gzip/base64 string), decodes it
and builds name indexes with the shared, type-checked
`db-codec.js`. Plain card objects and index-entry arrays are cloned once; main-thread `Map` hydration preserves
card identity. The original `CARD_DB`, `CARD_DB_COMPRESSED_B64`, `indexes`, `buildLookupIndexes` and
`window.__dbReady` contracts remain. No Worker / worker-side decompression support uses the same codec on the
main thread; no main-thread `DecompressionStream` still produces the existing unsupported-browser error.
Real fetch/decode/index progress advances the bar and resets a 30-second stall deadline; there is no total-load
timeout. Worker errors and stalls terminate the worker and use the existing boot error UI.

The opt-in `tests/e2e/db-boot.perf.spec.ts` benchmark uses Pixel 5 emulation, 6x CPU slowdown, 150 ms latency and
200,000 bytes/s download. Set `PM_BOOT_BENCHMARK=1` and run
`npm run e2e -- db-boot.perf.spec.ts --workers=1`; it reports three cold navigation-to-DB-ready runs, summing
`max(0, long-task duration - 50 ms)`, plus the `pm-card-index-hydration` performance measure.

`scripts/extract-bot-datasets.mjs` reproduces the fallback snapshots from pre-cutover HTML and pins win-rates
for golden tests. Both splice scripts have been deleted. Publish/assemble helpers in `.github/scripts/`
validate dataset shapes/counts and SHA-256 manifests; publication is lease-protected and serialized.
Legacy hash-only publications use their stable Git publication time until refreshed, never deploy time.
Committed snapshots initially use extraction time, not an inferred upstream generation date.
`node scripts/generate-data-manifest.mjs` reproduces derived metadata and bootstraps missing snapshot entries;
byte-identical entries keep their existing dates. Do not use manifest regeneration to hide a stale-data warning.

## Line map (approximate — always re-grep the identifier)

|       ~Line | Region                                                            | Identifier to grep                                                                                                |
| ----------: | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
|     12–1135 | Main CSS                                                          | `<style>` (first one)                                                                                             |
|         599 | Terraria × MTG Arena theme overrides                              | `Terraria x MTG Arena theme`                                                                                      |
|   1136–1287 | Colour themes (runs in `<head>`)                                  | `<script id="theme-script">`                                                                                      |
|   1299–1433 | Visual overhaul CSS                                               | `<style id="pm-visual-overhaul">`                                                                                 |
|   1435–1742 | `<body>` markup: auth bar, header, mode tabs, deck form           | `id="authBar"`, `<header>`, `class="mode-tabs"`                                                                   |
|   1461–1500 | Card-DB progress + progress-stall watchdog                        | `dbLoadFill`, `window.__dbProgress`                                                                               |
|        1617 | Result panels markup                                              | `id="resultsSection"`                                                                                             |
|   1742–1749 | Engine page globals + module shim (code in `src/engine`)          | `<script id="engine-script">`                                                                                     |
|   1750–1756 | Lookup/parser shim (code now in `src/cards`)                      | `<script id="lookup-script">`, `var buildLookupIndexes`                                                           |
|   1757–1766 | Card DB bindings                                                  | `<script id="data-script">`                                                                                       |
|   1767–1771 | Spellbook snapshot binding (data now external)                    | `<script id="combo-data-script">`                                                                                 |
|  1772–13816 | **App script** (UI + all features)                                | `<script id="app-script">`                                                                                        |
|   1777–2007 | Reference corpus bindings, percentiles, baselines                 | `REFERENCE_TIERS`, `function computeAxisPercentile`, `STAPLES_BASELINE`                                           |
|   2008–2011 | Try-a-Deck binding (decklists now external)                       | `let TRY_A_DECK_OPTIONS;`                                                                                         |
|        2053 | Card DB decode compatibility shim                                 | `async function decompressCardDB`                                                                                 |
|        2056 | Spellbook snapshot loader                                         | `async function loadSpellbookSnapshot`                                                                            |
|   2080–2180 | Eager/lazy dataset gates + worker startup                         | `loadStaticDatasets`, `loadDeckLibrary`, `loadAnalysisDatasets`, `loadKnowledge`, `initDatabase`                  |
|        2192 | Shared size limits (values in `src/services/cloud/limits.ts`)     | `---- Size limits`, `PM_INPUT_LIMIT_KEYS`                                                                         |
|        2277 | Card art (Scryfall, on demand)                                    | `CARD ART — fetched on demand`                                                                                    |
|        2343 | Card lookup                                                       | `async function lookup(name)`                                                                                     |
|        2403 | View Deck gallery                                                 | `VIEW DECK — full visual gallery`                                                                                 |
|        2688 | Chart request waits for fingerprint/metadata data                 | `async function runAnalysis`                                                                                      |
|   2839–3372 | Result panels: win-con, radar chart, bracket, mana                | `function renderWinCondition`, `function renderChart(`, `function renderBracket`, `function renderManaCurveChart` |
|        4990 | Synergy profile                                                   | `function renderSynergyProfile`                                                                                   |
|        5268 | Commander Centrality panel                                        | `function renderCommanderCentrality`                                                                              |
|        5599 | Sign in / sign up modal                                           | `SIGN IN / SIGN UP MODAL`                                                                                         |
|        5773 | Profile builder (link Archidekt/Moxfield)                         | `PROFILE BUILDER`                                                                                                 |
|   5886–7054 | **PriceScry** (Search, Movers, Radar, Ledger, trades)             | `PriceScry -- card price history`, `PRICESCRY_PW_SHA256`, `function psRenderRadar`                                |
|        6398 | Spoiler Bait                                                      | `SPOILER BAIT -- swipe`                                                                                           |
|        7100 | My Profile modal                                                  | `function renderProfileModal`                                                                                     |
|        7572 | Pods (create/join, members, invites)                              | `PODS — create/join`                                                                                              |
|   7788–8709 | Gatherings (host, RSVP, seats, live)                              | `function runSampleGathering`, `function openHostGatheringOverlay`, `function renderLiveGatheringTray`            |
|   8986–9353 | Impact cards + "Pod view" line                                    | `IMPACT_LS_KEY`, `function openImpactCardsModal`                                                                  |
|        9733 | Lazy Try-a-Deck entry point                                       | `async function showTryADeckModal`                                                                                |
|  9880–10139 | Scan cards (Tesseract OCR)                                        | `tesseractLoadPromise`, `function showScanCardsModal`                                                             |
|       10257 | Pod Comparison (up to 6 decks)                                    | `POD COMPARISON`                                                                                                  |
| 10803–11349 | Player / pod profile overlays                                     | `function getPlayerRawDecksForProfile`, `function openPlayerProfileOverlay`, `function openPodProfileOverlay`     |
|       11525 | Pod deck detail waits for fingerprint/metadata data               | `async function showPodDeckDetail`                                                                                |
|       11809 | Saved data: decks, formations, chronicles                         | `SAVED DATA — decks`                                                                                              |
| 11929–12629 | Deck Crafter (deck builder)                                       | `Build a Deck: search-and-add`, `function openDeckBuilderOverlay`                                                 |
|       13139 | My Data backup/restore                                            | `MY DATA — download/restore`                                                                                      |
|       13234 | Retired pod rosters (dead code)                                   | `POD ROSTERS -- retired`                                                                                          |
| 13819–13971 | Notifications inbox                                               | `<script id="notif-script">`                                                                                      |
| 13972–13975 | Cloud modules: size limits, then Firebase (`src/services/cloud/`) | `limits-global.ts`, `src/services/cloud/index.ts`                                                                 |

Line numbers above are approximate, updated for P3-3. The footer freshness element is at 1739.
Refresh this map when code moves noticeably.

## Gotchas

- **Card tuples are positional arrays.** The compressed DB stores each card as an array; `src/cards/tuple.ts` is the
  only place that maps a position to a field (`cardName`→`n`, `typeLine`→`t`, `oracleText`→`o`, then `c, ci, m, p,
r, pm, rt, pw, tg, x, ly, ob, bt`), and `build-card-db.mjs` writes the same order. Read tuples through those
  accessors, never `t[3]`. Newer fields are `undefined` on older DBs — keep the length guards inside `tuple.ts`,
  and never reorder or reuse a position.
- **Pod "Impact card" edits only affect the separate "Pod view" line** under the radar — never the main scores.
- **The PriceScry password is a soft gate**, not security (the code says so). Don't put anything sensitive behind it.
- **Be polite to external APIs:** Scryfall, Playgroup.gg and tcgcsv rate-limit and asked for identified traffic —
  keep the existing User-Agent headers and delays in `.github/scripts/*` and the workflows.
- **Engine scores are calibrated** against a 224-deck reference corpus; any change to `PATTERNS`, scoring or
  baselines shifts every deck's numbers. Don't do it as a side effect; use `/engine-change`.
- **User content is rendered with `innerHTML`** in many places: always wrap user/pod-supplied text in `escapeHtml(…)`.
- PriceScry helpers `nameKey()`, `fnv1a()`, `shardOf()` are duplicated in `.github/scripts/pricescry-lib.mjs`
  (grep `helpers kept identical to`); change both or neither, or price shards stop resolving.
- The cloud modules run last (modules are deferred); ordinary scripts must wait for `podmates-cloud-init` /
  `window.PodmatesCloud` before calling the cloud, and must not read `window.PM_LIMITS` during parsing.
- **Cloud layer:** `src/services/cloud/` holds one typed repository per Firestore area; `api.ts` assembles the
  unchanged `window.PodmatesCloud` surface. Only `firebase.ts` imports the SDK, and ESLint rejects
  `firebase/*` imports outside `src/services/cloud/**`. Tests mock `./firebase` with `testing/fake-firebase.ts`.

## Regenerating the map

```sh
grep -n -E '<script|</script>|<style|</style>|<body' index.html | cut -c1-120          # block boundaries
awk 'length > 3000 { print NR": "length" chars: "substr($0,1,50) }' index.html          # huge lines
grep -n -E '^\s*(//|/\*|<!--)\s*[=─-]{8,}' -A1 index.html | cut -c1-120                 # section banners
grep -n -E '^\s*(async\s+)?function\s+\w+\s*\(' index.html | cut -c1-100                # functions
```
