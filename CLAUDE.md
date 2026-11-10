# PodMates

Commander (MTG) playgroup companion: deck analysis ("Deck Chart"), pod social features (MyPods) and the PriceScry
price tool. Today the whole app is **one ~5.5 MB `index.html`** (HTML + CSS + JS + embedded data), served by Vite.
Full context: [docs/overview.md](docs/overview.md) · Plan: [docs/refactor-plan.md](docs/refactor-plan.md)

> **Interim file.** This describes the single-file app as it is now. It will be replaced by the target version
> (refactor plan, Appendix A) during Phase 3, once the code is split into `src/`.

## Commands

Use Node.js 22 or newer. Run `npm ci` to install the locked development dependencies.

- `npm run dev` — local Vite development server.
- `npm run build` — produce `dist/`; `index.html` is copied verbatim to preserve its inline scripts.
- `npm run preview` — serve the production build locally (run the build first).
- `npm run check` — typecheck + lint + unit/golden tests; must pass before finishing a change.
- `npx playwright install chromium` — install the browser once after `npm ci` (`--with-deps` on Linux CI).
- `npm run e2e` — Chromium smoke test; builds and starts an isolated Vite preview on port 4183.
  Browser tests are deliberately excluded from `npm run check`.
- `npm run typecheck`, `npm run lint`, `npm test` — run an individual check.
- `npm run format` — Prettier; excludes `index.html`, data and lockfiles. Review diffs before committing.
- `npm run golden` — full analysis and all five axis snapshots for every embedded sample deck.
- `npm run golden:update` — intentionally accept reviewed engine output changes.
- `npm run golden:fixture` — regenerate pinned cards/Spellbook from the local HTML; proves full-data parity.

TypeScript is strict for new TypeScript; legacy JavaScript has `checkJs: false` and warn-only lint rules.
ESLint does not inspect inline HTML scripts yet.
Static icons and the web manifest live in `public/` and keep their original URLs in dev and production.
CI checks every PR (including stacked bases) and `main`; Pages builds/deploys and weekly-refresh
triggering are defined in `.github/workflows/{ci,deploy}.yml`. See [docs/deploy.md](docs/deploy.md)
for build-only validation, the human Pages source switch and rollback.

## Golden harness

`tests/golden/harness.ts` loads the inline engine through `source.mjs`, using `/* @golden:<block>:start */` /
`:end` markers rather than line numbers. Preserve the markers when moving code. Blocks cover engine, lookup,
corpus, sample decks, card decoding, suggestion legality and combo outcomes; no app startup, DOM or network runs.

The current library has **178 decks** (the prompt's 174 predates four Star Trek decks). Fixtures pin 7,621 card
records and 3,397 Spellbook rows, including one-card-away combo candidates so the _whole_ analysis is preserved.
Ordinary golden/check runs never decode the live data blobs. Regenerate fixtures only deliberately, then review
the snapshot diff; weekly data refreshes must not automatically update this baseline. JSON object keys are sorted
recursively; array order and floating-point values are preserved without rounding.

## Browser smoke test

The smoke test in `tests/e2e/smoke.spec.ts` waits for the real DB-ready message, charts a Try-a-Deck sample,
checks the radar and populated panels, then analyses a pasted short list. `tests/e2e/offline.ts` stubs Firebase's
CDN modules as signed out (including its ready callback); the real app bridge still executes. No anonymous
account is created and no Firestore traffic is sent. Scryfall art/API and Google Fonts are fulfilled locally;
all other external requests fail the test without leaving the browser. Console errors and uncaught page errors
always fail, with no noise allow-list. `@axe-core/playwright` is installed for later accessibility assertions.

## Golden rules

1. **Always start from the latest `main`.** Weekly bots rewrite data lines inside `index.html` on `main`; editing an
   older copy silently reverts that data (this has happened — see overview §5.1).
2. **Never regenerate, re-download or re-upload the whole `index.html`.** Edit only the lines you need.
3. **Never touch the bot-managed lines** (the weekly workflows splice them via `.github/scripts/splice-*.mjs`):
   - `const CARD_DB_COMPRESSED_B64 = …` — `rebuild-card-database.yml`
   - `const IX_TAGS_JSON = …` — `rebuild-card-database.yml`
   - `const COMMANDER_TIER_DATA = …` — `rebuild-winrate-database.yml`
4. **Never change Firestore paths or field names** (`users/{uid}/…`, `pods/{podId}/…`). Real user data depends on them.
5. **Open a PR; never push to `main`.** One feature or fix per PR.
6. No behaviour change unless asked (no visual, score or data-model changes as side effects).
7. Never commit secrets. The Firebase web `apiKey` in the file is public by design.

## How to read `index.html`

- **Never read or print the whole file**, and never print the huge data lines (table below) — some are megabytes.
- Find things with grep, then do a ranged read (`view` with a line range, `sed -n 'A,Bp'`, etc.).
- Grep for the **identifier**, not the line number: line numbers drift with every edit.
- When grepping, cap the output width (e.g. `grep -n … | cut -c1-200`) so a match on a data line can't flood output.
- Scripts share **one global scope**: every top-level `function`/`const` is visible everywhere. Grep before
  renaming or adding a top-level name. Cross-script contracts: `window.PodmatesCloud`, `window.pmNotif`,
  `window.PM_LIMITS`, `window.__dbReady`, and the `podmates-cloud-init` event.

### Huge single-line data blobs — do not print

| ~Line | Identifier (grep for this) | Size | Managed by |
|---:|---|---:|---|
| 6 | `<link rel="icon"` (inline base64 PNG) | 11 KB | hand |
| 1450 | `<img src="data:image/jpeg;base64` (header art) | 25 KB | hand |
| 2157 | `const HARD_COMBOS =` | 10 KB | hand-curated |
| 4259 | `const COMMANDER_TIER_DATA =` | 85 KB | **bot — do not edit** |
| 4875 | `const CARD_DB_COMPRESSED_B64 =` | 2.9 MB | **bot — do not edit** |
| 4880 | `const SPELLBOOK_SNAPSHOT_B64 =` | 0.5 MB | manual paste from `spellbook-snapshot-probe.yml` |
| 4977 | `const PRECON_FINGERPRINTS =` | 60 KB | script not in repo |
| 23551 | `const IX_TAGS_JSON =` | 5 KB | **bot — do not edit** |
| 23555 | `const KNOW_JSON =` | 298 KB | `know-build.cjs` (not in repo) |
| 28986 | `const IMPACT_CANDS =` | 7 KB | `impact-cands.cjs` (not in repo) |

Also long (3–5 KB, avoid printing): `SOFT_SYNERGIES` (2199), `REFERENCE_SCORES` (4911), `MANABASE_BASELINE` (5073).

## Line map (approximate — always re-grep the identifier)

| ~Line | Region | Identifier to grep |
|---:|---|---|
| 12–1135 | Main CSS | `<style>` (first one) |
| 599 | Terraria × MTG Arena theme overrides | `Terraria x MTG Arena theme` |
| 1136–1287 | Colour themes (runs in `<head>`) | `<script id="theme-script">` |
| 1299–1433 | Visual overhaul CSS | `<style id="pm-visual-overhaul">` |
| 1435–1742 | `<body>` markup: auth bar, header, mode tabs, deck form | `id="authBar"`, `<header>`, `class="mode-tabs"` |
| 1461–1500 | Card-DB loading bar + watchdog | `dbLoadFill` |
| 1617 | Result panels markup | `id="resultsSection"` |
| 1743–4663 | **Engine** (DOM-free): classification & scoring | `<script id="engine-script">` |
| 1871 | Oracle-text regex patterns | `const PATTERNS =` |
| 2091 | Game Changer reasons | `const GAME_CHANGER_REASONS =` |
| 2157–2340 | Curated combos + Spellbook matching | `HARD_COMBOS`, `function buildSpellbookIndex`, `function matchSpellbookCombos` |
| 3098 | Commander Centrality | `function computeCommanderCentrality` |
| 3232 | Main analysis entry point | `function analyzeDeck(` |
| 3905–4160 | Axis scoring | `function scoreSpeed`, `scoreConsistency`, `scoreVersatility`, `scoreDisruption`, `scorePowerLevel` |
| 4074 | Default impact cards | `const DEFAULT_IMPACT_CARDS =` |
| 4259–4300 | Win-rate data + lookup | `COMMANDER_TIER_DATA`, `function lookupCommanderTiers` |
| 4430 | Bracket detection | `function detectBracket` |
| 4664–4861 | **Lookup/parser** (DOM-free) | `<script id="lookup-script">`, `function parseDecklist(` |
| 4862–4876 | Card DB data | `<script id="data-script">` |
| 4877–4881 | Spellbook snapshot data | `<script id="combo-data-script">` |
| 4882–33787 | **App script** (UI + all features) | `<script id="app-script">` |
| 4908–5110 | Reference corpus, percentiles, baselines | `REFERENCE_TIERS`, `function computeAxisPercentile`, `STAPLES_BASELINE` |
| 5115–21950 | Try-a-Deck library (~16.8k lines of decklists) | `const TRY_A_DECK_OPTIONS = [` |
| 21990 | Card DB decompression + card tuple decoding | `async function decompressCardDB` |
| 22068 | Spellbook snapshot loader | `async function loadSpellbookSnapshot` |
| 22153 | Shared size limits | `window.PM_LIMITS =` |
| 22228 | Card art (Scryfall, on demand) | `CARD ART — fetched on demand` |
| 22295 | Card lookup | `async function lookup(name)` |
| 22354 | View Deck gallery | `VIEW DECK — full visual gallery` |
| 22788–23330 | Result panels: win-con, radar chart, bracket, mana | `function renderWinCondition`, `function renderChart(`, `function renderBracket`, `function renderManaCurveChart` |
| 24986 | Synergy profile | `function renderSynergyProfile` |
| 25264 | Commander Centrality panel | `function renderCommanderCentrality` |
| 25594 | Sign in / sign up modal | `SIGN IN / SIGN UP MODAL` |
| 25768 | Profile builder (link Archidekt/Moxfield) | `PROFILE BUILDER` |
| 25881–27050 | **PriceScry** (Search, Movers, Radar, Ledger, trades) | `PriceScry -- card price history`, `PRICESCRY_PW_SHA256`, `function psRenderRadar` |
| 26393 | Spoiler Bait | `SPOILER BAIT -- swipe` |
| 27096 | My Profile modal | `function renderProfileModal` |
| 27567 | Pods (create/join, members, invites) | `PODS — create/join` |
| 27784–28700 | Gatherings (host, RSVP, seats, live) | `function runSampleGathering`, `function openHostGatheringOverlay`, `function renderLiveGatheringTray` |
| 28967–29330 | Impact cards + "Pod view" line | `IMPACT_LS_KEY`, `function openImpactCardsModal` |
| 29862–30120 | Scan cards (Tesseract OCR) | `tesseractLoadPromise`, `function showScanCardsModal` |
| 30238 | Pod Comparison (up to 6 decks) | `POD COMPARISON` |
| 30785–31330 | Player / pod profile overlays | `function getPlayerRawDecksForProfile`, `function openPlayerProfileOverlay`, `function openPodProfileOverlay` |
| 31785 | Saved data: decks, formations, chronicles | `SAVED DATA — decks` |
| 31906–32600 | Deck Crafter (deck builder) | `Build a Deck: search-and-add`, `function openDeckBuilderOverlay` |
| 33109 | My Data backup/restore | `MY DATA — download/restore` |
| 33204 | Retired pod rosters (dead code) | `POD ROSTERS -- retired` |
| 33811–33963 | Notifications inbox | `<script id="notif-script">` |
| 33964–35326 | **Firebase module** (Auth + Firestore) | `<script type="module">`, `const firebaseConfig` |
| 34360–34760 | Cloud: formations, trades, chronicles, gatherings | `async function cloudSaveTableFormation`, `cloudSaveTrade`, `cloudCreateGathering` |
| 34779 | Deck-sync Worker (Archidekt/Moxfield import) | `SYNC_WORKER_URL`, `async function fetchDeckByLink` |
| 35196 | Cloud: pod impact settings | `async function cloudLoadImpactSettings` |
| 35275 | Cloud bridge exposed to ordinary scripts | `window.PodmatesCloud = {` |

Line numbers checked against `main` @ `0df0995`. Refresh this map when your change moves things noticeably.

## Gotchas

- **Card tuples are positional arrays.** The compressed DB stores each card as an array; `decompressCardDB` maps
  index → short key (`t[0]`→`n` name, `t[1]`→`t` type line, `t[2]`→`o` oracle text, then `c, ci, m, p, r, pm, rt,
  pw, tg, x, ly, ob, …`), and `build-card-db.mjs` writes the same order. Newer
  fields are `undefined` on older DBs — keep the `t.length > N` guards, and never reorder or reuse an index.
- **Pod "Impact card" edits only affect the separate "Pod view" line** under the radar — never the main scores.
- **The PriceScry password is a soft gate**, not security (the code says so). Don't put anything sensitive behind it.
- **Be polite to external APIs:** Scryfall, Playgroup.gg and tcgcsv rate-limit and asked for identified traffic —
  keep the existing User-Agent headers and delays in `.github/scripts/*` and the workflows.
- **Engine scores are calibrated** against a 224-deck reference corpus; any change to `PATTERNS`, scoring or
  baselines shifts every deck's numbers. Don't do it as a side effect.
- **User content is rendered with `innerHTML`** in many places: always wrap user/pod-supplied text in `escapeHtml(…)`.
- PriceScry helpers `nameKey()`, `fnv1a()`, `shardOf()` are duplicated in `.github/scripts/pricescry-lib.mjs`
  (grep `helpers kept identical to`); change both or neither, or price shards stop resolving.
- The Firebase module runs last (modules are deferred); ordinary scripts must wait for `podmates-cloud-init` /
  `window.PodmatesCloud` before calling the cloud.

## Regenerating the map

```sh
grep -n -E '<script|</script>|<style|</style>|<body' index.html | cut -c1-120          # block boundaries
awk 'length > 3000 { print NR": "length" chars: "substr($0,1,50) }' index.html          # huge lines
grep -n -E '^\s*(//|/\*|<!--)\s*[=─-]{8,}' -A1 index.html | cut -c1-120                 # section banners
grep -n -E '^\s*(async\s+)?function\s+\w+\s*\(' index.html | cut -c1-100                # functions
```
