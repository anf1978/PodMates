# PodMates Product Bible

> **Historical document, frozen as of 2026-11-10.** This is the hand-kept handover log from before the
> TypeScript refactor (doc [004](../changes/004_refactor_typescript-migration.md)). Its architecture, file layout,
> workflow ("Claude delivers complete files") and known-issues sections are out of date. Wherever it disagrees
> with [CLAUDE.md](../../CLAUDE.md), [architecture.md](../architecture.md), [overview.md](../overview.md) or the
> change docs in [docs/changes/](../changes/README.md), those win. It is kept for the reasoning behind decisions:
> the Revisions and Passes record why scoring, brackets and PriceScry work the way they do. The rules that still
> bind are copied into [src/engine/CLAUDE.md](../../src/engine/CLAUDE.md) and
> [src/features/pricescry/CLAUDE.md](../../src/features/pricescry/CLAUDE.md). Do not edit it; record new
> decisions in a change doc.

**Compiled:** October 2026 — end of a single, very long development session
**Revised:** October 11, 2026 — Revision 3 (plus Revision 3.1, bracket timing rules, Revision 3.2, banned cards and the commander in scoring, Revision 3.3, the three-tier reference set, default impact cards and pod impact-list editing, Revision 3.4, the Commander Spellbook snapshot counted in the standard scores, Revision 3.5, spirit-band re-fit, cEDH-capable note and Centrality re-calibration, Revision 3.6, PriceScry backtests, cheap-pick watch and pasted spoilers, and Revision 3.7, Deck Crafter search, Load Deck reliability, logo, front page and colour themes), adding PriceScry (new Section 14), the Chronicles edit/delete and display-name changes, and the updated Firestore rules (see the Revision 3 summary right below). Revision 2 (October 3, 2026) covered everything built after the first compile. Section cross-references were also repaired: several pointed at an older numbering.
**Purpose:** Everything a new Claude conversation needs to pick up PodMates development and architecture from exactly where this session left off, without re-discovering anything the hard way.

---

---

## Revision 3 summary — what changed since Revision 2 (October 11, 2026)

1. **PriceScry** is a new password-gated feature (Section 14): MTG card price history, movers, signals, a trade **Ledger**, a **Radar** tab, and a **Prediction scoreboard**, fed by a daily GitHub Action that publishes data to the `pricescry-data` branch. It is for Anthony's own use buying in Japan and selling on Mercari. If you read only one new block, read Section 14.
2. **Firestore rules were replaced** (Section 5.1): new `users/{uid}/trades` rules, and a `canManageChronicle()` rule for Chronicle edit/delete. Anthony published them in October 2026.
3. **Chronicles can now be edited and deleted** (Section 6): by the players who were in that battle and by the pod's leaders; entries with no player list (from before Gatherings) can be managed by any pod member. Edited notes record who edited them (`notesEditedBy`).
4. **Display-name uniqueness** (Sections 6, 7): joining or renaming checks the pod for a member with the same name (`findNameConflict`, ignoring case, spacing and invisible characters). It is a **courtesy check, not a security boundary**: a failed lookup lets the person through. Older clashes keep their stored names and show numbered labels ("Alex (1)", "Alex (2)").
5. **Back navigation in PriceScry** returns to the list you came from, at the same scroll position (Section 14.7).
6. Delivery convention unchanged: complete files; `index.html` in the repo root; workflows in `.github/workflows/`; scripts in `.github/scripts/`; `firestore.rules` pasted into the Firebase console.

---

## Revision 3.7 — Deck Crafter search, Load Deck reliability and the delete bug (October 20, 2026)

Found while using the app from an iPhone home-screen icon. All in `index.html`.

- **Delete bug (root cause).** `cloudDeleteDeck(key, docIdOverride)` ran the override through `safeDocId` again. The override comes from `docSnap.id`, which is already encoded, so any deck name with a space or bracket was double-encoded, pointed at a document that did not exist, and Firestore reports deleting a missing document as success. Now: the id is used as given, the encoded key and raw key are tried as fallbacks, the document is checked before and after, and an error is thrown if it still exists. The screen also drops the deck at once. (Saves pass a *key*, not an id, so they were not affected.)
- **Load Deck false "No saved decks yet".** `refreshCloudDecksCache` used to set the cache to `{}` on any error or if sign-in had not been confirmed yet (typical when opened from a home-screen icon). Now: it waits for the cloud module's ready signal, retries three times, shares one in-flight request, and keeps the old list on failure. It returns true only when the result is known to be right. The red message appears only when a load *succeeded* and found nothing; a failed load shows "didn't finish loading" with a Retry button.
- **Partial PodMates member lists.** `refreshPodmateDecksCache` is rebuilt: one shared in-flight request, retries on pods/members/decks, builds the new map aside and swaps it in whole, keeps earlier decks for any podmate whose fetch failed, and flags partial results (Retry notice). It uses `loadPodmateDecksRaw` so a real failure is no longer mistaken for "nothing shared" (permission-denied still counts as nothing shared).
- **Stays fresh without re-login.** `pmWarmDeckCaches` refreshes quietly on `visibilitychange` (visible), `focus`, `pageshow` (restored), `online`, and when sign-in is confirmed; an open Load Deck list redraws.
- **One fuzzy search for every card box** (`searchNorm`, `searchDist`, `getSearchIndex`, new `searchCardsByName`). Lower-case, accents and apostrophes removed, æ/œ/ß folded, other punctuation as spaces. Tiers: exact, starts-with, word-start, contains (spaces ignored), every-word-in-any-order, then typo-tolerant (swaps/missing/extra letters; 1 slip for 4–7 letter words, 2 for longer; also a missing space). Typo tier only runs when exact tiers did not fill the list. Tested on ~2,000 generated typos: right card in top 5 over 99%. About 40 ms per search once the index is built. `opts.preferCommanders` ranks legendary creatures first in the commander box. The Load Deck filter also ignores accents/apostrophes.
- **One look for every card box** (`pmWireCardSearch`, `pmSearchRowsHtml`). Used by Deck Crafter (commander and cards), PriceScry search, the trade-form card box, and Impact cards. Results sit directly above the box, best match nearest the box, 17px text, 48px+ rows, typed part in gold, best row marked. A tap is taken from the press itself (name captured at pointerdown, ignoring slides), so a list refresh can never swallow it; mousedown is prevented so the keyboard stays up; an unchanged list is never rebuilt; the box stays put on screen while the list appears or disappears; Enter takes the best match. This fixed the "unresponsive until I type more" problem (the list was rebuilt under the finger).
- **Commander auto-add.** `setDeckBuilderCommander(name)` adds the commander to the deck list (qty 1) and removes the previous one when changed/cleared. A commander already set in an old draft is added when the builder opens. (The analysis finds the commander from the deck list, so a builder deck without it was a card short.)
- **Logo / home-screen icon.** `apple-touch-icon.png` (180×180, opaque, full-bleed) must sit in the repo root next to `index.html`; the page links it with `rel="apple-touch-icon"`, plus an inline 64px favicon, `apple-mobile-web-app-title` = PodMates and `theme-color`. Deliberately NOT added: `apple-mobile-web-app-capable` (could switch the shortcut to standalone mode, which has separate storage and would log him out). Android: `manifest.webmanifest` plus `icon-192.png`, `icon-512.png` and `icon-maskable-512.png` (logo at 80% on dark, for round/squircle masks) sit in the repo root next to `index.html`; the manifest uses `display: browser` on purpose (same sign-in/storage behaviour as the browser; switch to `standalone` only after testing Google sign-in popups in it). iOS reads the icon when the shortcut is created, so an existing shortcut must be removed and re-added.
- **Front page.** The logo (embedded 260px JPEG, 130px circle) heads the Home Screen; the visible "Pod Mates" title is hidden (kept for screen readers). Under 430px wide the tagline is one line (10.5px) and the header is tighter. Pinch-zoom is allowed again (`maximum-scale`/`user-scalable=no` removed from the viewport meta); on touch screens text boxes are 16px so iOS does not auto-zoom when one is tapped.
- **Colour themes (Display settings in My Profile).** 27 themes: Classic PodMates (default), 10 guilds, 10 triomes (5 shards + 5 wedges, each also named by its triome land), 5 four-colour combinations (Yore-Tiller, Glint-Eye, Dune-Brood, Ink-Treader, Witch-Maw) and WUBRG. No single-colour themes; dark only; saved per device in `localStorage['podmates-theme']`; logo unchanged. A theme is only new values for the shared CSS variables, so every screen follows it. The engine is the small `<script id="theme-script">` in the head (so the saved theme applies before first paint): `PMTheme.themes/build/apply/saved/audit`. `build()` makes a palette from the colour letters: base tint from the leading colour (priority R, U, G, B, W; WUBRG uses a neutral base and gold + orchid), accents from a fixed bright colour per mana colour, and every text/accent colour is nudged to a minimum contrast on all four backgrounds (primary text 12:1, soft text 7.5:1, dim text 4.8:1, accents 5.5:1, and dark button labels `#1A1208` on gold ≥ 4.5:1). `PMTheme.audit()` returns failures across all themes (currently none) — re-run it after changing any colour. Semantic colours do NOT change with the theme: success green, danger red, tier S–D colours, mana colours, chart series, pod colours. To make this work, translucent accents were converted to `rgba(var(--gold-rgb), a)` (also `--cyan-rgb`, `--glow-a-rgb`, `--glow-b-rgb`) and the button shadow uses `--bronze-dark`. New hard-coded gold/teal in CSS should use the variables, or it will not follow the theme. The UI is `renderDisplaySettings`/`pmThemeTileHtml` (tiles preview their own theme, show the existing `manaSymbol` pips and the colour names).
- **One deck, one row (linked + saved duplicates).** A linked Archidekt/Moxfield deck keeps a hidden mirror doc (`linked-{platform}-{deckId}` in `users/{uid}/decks`). If the owner also charted and saved the same deck, lists showed both. `pmDropLinkedDuplicates` (near `loadSavedDecks`) now hides the mirror, per owner, when a non-mirror saved deck has the same commander and ≥70% of the same cards (≥85% if a commander is missing on one side). Applied in Load Deck (`renderLoadDeckList`), Build Table (`buildSavedDecksTable`) and player profiles / Archetypes (`getPlayerRawDecksForProfile`). Display-only: nothing is deleted, the link, its re-sync, the mirror and the My Profile linked-decks list are untouched, and if the saved deck is deleted the linked one shows again. Deliberately NOT applied to `cloudLoadAllDecks` or the cache: the profile merge uses mirrors to recognise linked decks and would re-create them. `cloudLoadPodmateDecksRaw` now returns `docId` so podmates' mirrors can be recognised.
- **Linked badge.** In Load Deck, a deck that is linked to Archidekt/Moxfield (a saved deck whose duplicate mirror was hidden, or a linked deck shown on its own) carries a small "🔗 Moxfield" / "🔗 Archidekt" pill. `pmDropLinkedDuplicates` sets `linkedVia` on the kept deck each time it runs (cleared first, so it never goes stale); `pmLinkedSite(docId)` reads the site from the mirror id.
- **Commander Centrality: keywords (step 1 of the synergy-credibility work).** The synergy web only knows 15 fixed themes, so a commander that rewards a KEYWORD (e.g. Arcades: "creatures with defender") had no links and the panel read "Self-sufficient" (21) for a 36-defender Wall deck. Now `centralityFedCards` also reads keywords the commander is ABOUT (`CENTRALITY_KEYWORDS`: "with <kw>" / "<kw> creatures/permanents/spells"; its own keyword line or granting a keyword does not count), counts cards that carry the keyword as their own keyword ability (Walls count for defender), uses 75th-percentile precon shares as baselines (`CENTRALITY_KEYWORD_BASELINE`, default 0.02, flying 0.15), and returns `byTerm`/`kwFed`. In `computeCommanderCentrality`: keyword-fed cards get synthetic commander edges (this reading only; they count toward cluster collapse and edge share but NOT as 'orphans', since a flyer still flies without the commander); and if there is no combo/specific win condition, ≥5 keyword-fed cards and alignment ≥ 0.6, the commander counts as the plan (plan = alignment). Wall deck: 21 → 76 (All-in). Regression on the 159 precon/curated decks: only Millicent changed (52 → 71, flying). A broader plan inference (any theme, not just keywords) shifted 73 decks up a band and was deliberately NOT adopted — it would need the band cut-offs re-calibrated first. Still to do (next steps agreed with Anthony): a general payoff/enabler matcher across the 100 cards, plan-weighted ranking of interactions, and a rebuilt Synergy Profile (key pieces, be-wary-of, cut candidates).
- **Not changed:** scoring, tiers, brackets, Firestore rules.

## Revision 3.6 — PriceScry backtests, cheap-pick watch and pasted spoilers (October 12, 2026)

Context: Anthony's goal is **bulk-buying old cards that sell for pennies and jump after a synergistic new card is printed** (not gambling on new cards). Cheap cards are easy to source and sell in bulk in Japan, so small per-card profits multiply. He will watch results for a few months and try paper trades.

**Backtests run on the 90-day history (Oct 12, 2026; scripts in `.github/scripts/`, workflows "PriceScry Backtest" and "PriceScry Bulk Jump Backtest", both run-on-demand, read-only):**
1. `pricescry-backtest.mjs` replays the link engine on the $2+ candidates (315 new cards, 297 with picks). Top 5 picks per new card beat ordinary same-price cards (+25% hit rate 4.4% against 1.4% at 14 days; extra return about +3.8%), but the extra return is far below the 20% round-trip cost, so it is a research aid, not a bet. Pick-level numbers overcount; per-new-card counting is the honest unit, and per-SET counting is stricter still.
2. `pricescry-bulkjump.mjs` tests cheap picks (under 150 yen, first printed 14+ days before the new card, 3 days in a row at the target). **Zero picks reached 300 yen** (ordinary cheap cards would give about 1 hit; the target is too rare for 90 days of data). Looser targets (150 yen and 3x; 100 yen and 2x) at 30-45 days gave 8-11 hits against about 2-3 expected, but with set-level counting **every range includes zero (8 sets)**. Nearly all hits came from one tribal set (the Hobbit sets, `hob`/`hoc`, Aug 2026) and only four old cards: Hammers of Moradin (77 to 251 yen), Bearded Axe (67 to 209), Exemplar of Light (70 to 178), Wirewood Channeler (54 to 111). Baskets of one of each pick gained only 1-5%. Verdict: plausible mechanism (tribal payoffs lifted by a tribal set), **not proven**; one release cannot show a repeatable method.
3. Limits to remember: yen figures are shop-consensus prices converted at the day's rate, not Japanese shop or Mercari sold prices; MTGJSON gives only about 90 days of history, so more backtesting on this data would repeat the same four cards. Decision: **stop backtesting; learn forward.**

**Built for forward learning:**
- `pricescry-cheapwatch.mjs` (`log` and `eval`), run as a new step in `pricescry-daily.yml` ("Cheap-pick watch ...", `continue-on-error: true`). For every new card (from `signals.json.gz`) and every pasted leak it writes down up to 25 cheap picks (under 150 yen) with that day's price into `cheapwatch.json.gz`, then scores each pair 14/30/45/60 days later against ordinary cheap cards in the same yen band (every 4th card as the control), for three targets (300 yen; 150 yen and 3x; 100 yen and 2x), counted **per set**. Each scored result is stored once and never recomputed. Verdict (loosest target, 30 days, all picks) needs at least 5 releases and 5 expected hits; until then the status is "collecting". It also writes `cheapwatch-report.json` with `moving` (cheap picks up 1.5x or more since their card appeared), `watching` (latest cards and their picks) and `hitCards`.
- **Pasted spoilers:** `pricescry-spoilers.txt` at the repo root (main branch). Blocks separated by `---`; line 1 name, line 2 `mana cost | type line`, then rules text, optional `rarity:` line; `#` lines ignored. The next daily run logs the card with that day's prices (so picks exist before release) and also adds it to `radar-events.json`, so the $2+ prediction scoreboard learns from it. A card already logged is never logged twice.
- **Page:** Signals tab now shows a "Cheap-pick watch" panel under the Prediction scoreboard (`psCheapwatchHtml`, reads `cheapwatch-report.json`; everything escaped; tested in Chromium with an injected `<img onerror>`).
- Changed existing files: `pricescry-shadow.mjs` evaluate gained additive per-new-card fields (the daily scoreboard is unchanged); `pricescry-backtest.mjs` exports `readBulk`.
- Not built yet: the PodMates deck-knowledge ranker (only worth building once the forward log shows the link engine has any edge); Japanese shop and Mercari sold prices (the real test of "300 yen"); a "paper trade" link from a moving pick into the Ledger.

**Build table (MyPods), October 14, 2026:** three new sortable columns **Precon %, Tuned % and cEDH %** sit between Spark and Bracket. Each is the share of that reference tier's decks the deck's Spark scores above (`computeTierPlacement(spark, null)`), with a one-line explanation under the table. Code: `buildSavedDecksTable`, `SAVED_DECKS_TABLE_COLUMNS`, `renderSavedDecksTable`.

**Sign-in help (October 15, 2026).** Problem: a user on a new browser forgot which email they signed up with, so password reset was impossible. Firebase deliberately will not say whether an address has an account, so the fix is to show the email *while signed in* and to help at the login window. (1) **My Profile > "Your sign-in details"** (`renderProfileSignInBox`): shows the account email, how it signs in (email and password / Google), a **Copy email** button and an **Email me a password reset link** button (Google-only accounts are told they have no PodMates password). `describeUser` now also returns `providers`. (2) **Log In window:** prefills the email last used on this browser (`localStorage` key `podmates_last_signin`, this browser only), keeps what was typed when an error redraws the window, and has a help line (try Continue with Google, try each address, My Profile shows the email afterwards). (3) The "Forgot password?" message now says "If X has a PodMates account, a reset link is on its way" instead of claiming it was sent, because Firebase reports success for unknown addresses too. **Lockout recovery for the owner:** Firebase console > Authentication > Users lists every account's email, so a forgotten address can be looked up there.

## Revision 3.5 — Spirit bands re-fitted, "could function at a cEDH level", Centrality re-calibrated (October 12, 2026)

1. **Spirit bands (Core / Focused / Tuned) re-fitted** to the three-tier reference set. Constants `SPIRIT_TUNED_SPARK` 6.0 / `SPIRIT_TUNED_SIGNALS` 5, `SPIRIT_FOCUSED_SPARK` 5.0 / `SPIRIT_FOCUSED_SIGNALS` 3 (before `detectSpiritBand`). Result: 123 of 153 precons Core, 30 Focused, none Tuned; 34 of 36 tuned decks Tuned (2 Focused); all 20 cEDH lists Tuned. The old cut-offs (3.7 / 5.8, one / three signals) left no precon in Core. **There is deliberately no cEDH band.**
2. **"Could function at a cEDH level"** is a separate note, not a bracket. `detectBracket` now wraps `detectBracketCore` and sets `cedhCapable` (Spark >= 8.0, Power Level >= 9.5, >= 5 tuning signals) plus `cedhNote`; `renderBracket` shows it as a gold-outlined line under the bracket reasoning. Fires for 0 of 153 precons, 10 of 36 tuned decks, 18 of 20 cEDH lists. Bracket 5 is still never assigned; the Bracket 4 note and the bracket explainer say so.
3. **Centrality panel re-calibrated** with combos on, across all 209 decks. The 159 precon/curated decks give 25% Self-sufficient / 42% Supported / 23% Reliant / 10% All-in, so the cut-offs (25 / 43 / 52) and weights are unchanged. Tuned + cEDH decks read lower (42% Self-sufficient) because they run several combo routes. The explainer text and a comment above `CENTRALITY_BANDS` record this.

## Revision 3.4 — Commander Spellbook snapshot counted in the standard scores (October 12, 2026)

**Combos now count in the standard scores; the Recalibrate step is gone.** A compact offline copy of Commander Spellbook's combos is embedded in `index.html` (`<script id="combo-data-script">`, constant `SPELLBOOK_SNAPSHOT_B64`, about 480 KB of base64; the file grew from 4.07 MB to about 4.55 MB). Removed: the "Additional Combos — Commander Spellbook" panel, "Find More Combos", "Recalibrate scores with these combos", `recalibrateWithExternalCombos`, `fetchSpellbookCombos` and the Cloudflare Worker call (`SPELLBOOK_WORKER_URL`). The Worker (Section 5.4) is no longer used by the page and can be left alone or deleted. Anthony's decision: combos should count as they win or warp games.

- **Source and size:** the export at `https://json.commanderspellbook.com/variants.json` (about 687 MB, downloads in about 7 s on a GitHub runner; honest User-Agent; 114,450 combos on 2026-10-12, export version 7.1.9). `.github/scripts/spellbook-snapshot.mjs` (stream-reads the file; a single `JSON.parse` of 687 MB fails) plus `spellbook-compact.mjs` produce two files, run on demand by the workflow `.github/workflows/spellbook-snapshot-probe.yml` ("Spellbook Snapshot Build"; download the `spellbook-snapshot` zip from the run page): `spellbook-app-snapshot.json.gz` (what is embedded) and `spellbook-snapshot.json.gz` (full: every kept combo with all its effects, tag, popularity) plus `spellbook-stats.txt`. Refreshing = run the workflow, send the zip, then re-embed and regenerate the benchmark arrays together (they must move together).
- **What is kept (the "win or warp" rule):** status OK, commander-legal, 2-6 named cards, no template requirements ("any creature" slots cannot be tested by name). A combo is class 2 (win) if it produces a win/lose-the-game effect, infinite or near-infinite damage or life loss, library exile and similar (`WIN_RE`), class 1 (warp) for infinite turns or combat phases, infinite mana, locks, mass land denial, library-cheat effects, infinite card draw (`WARP_RE`); everything else (pure infinite ETB, LTB, death, sacrifice, token, lifegain, storm-count loops) is dropped because it needs a separate finisher. A combo that merely extends a smaller kept combo is dropped. Result: 64,495 combos, 6,283 cards, 126 outcome labels. Snapshot row = `[cardIdx[], code, outcomeIdx, popLog]`, code = class + 4 if infinite. All 7,341 card names in the export matched the app's database exactly.
- **Engine:** `buildSpellbookIndex`, `matchSpellbookCombos` and `SPELLBOOK_INDEX` (engine-script; null in the headless test harness unless set); the app sets the index in `initDatabase()` via `loadSpellbookSnapshot()` and never blocks on failure (status line then says only the built-in list is used; `window.__spellbookError` holds the reason). In `analyzeDeck`, right after the `HARD_COMBOS` loop: snapshot lines already covered by a curated combo are skipped (curated details now carry `matchedNames`); lines are ranked (class, fewer cards, commander piece, popularity); near-duplicates (same outcome, differing by one card) are skipped; the best `SPELLBOOK_MAX_COMBOS` = 6 are fed in, and `agg.spellbookMatched` records how many matched in total. They go into `detectedCombos` / `detectedComboDetails` with `source: 'spellbook'` and `comboClass`, so Win Condition, Versatility, Power, the timing estimate, the Bracket rules and every combo display see them automatically.
- **Weights:** reliability = (1.0 win, 0.5 warp, times 0.85 for 4+ cards) + 0.5 if the commander is a piece + the usual tutor/draw/protection support scaled by the same weight. **Bracket:** only a win-class infinite line can count as the two-card combo that bumps to Bracket 4 (`bracketRelevant`); a first draft let infinite-combat-phase lines bump five precons to Bracket 4, which is wrong. `detectBracket` skips two-card details with `bracketRelevant === false`.
- **Wording updated:** status line ("N combo line(s) counted", with a count of extra lines found but not scored), results panel ("Combos that win or warp the game", with a source note and snapshot date), and the Versatility, Power, Win Condition and Bracket explainers.
- **Benchmark re-run (209 decks) with combos on:** precons 15 of 159 moved, none changed Bracket; tuned decks rose (median 7.5 to 8.1 over the 36, 19 of the 30 EDHREC decks moved, Korvold 7.6 to 8.8); cEDH barely moved (10 of 20, median 9.2). Final tier stats: 153 precons median 4.5 (max 5.9), 36 tuned median 8.1 (range 4.8-9.4), 20 cEDH median 9.2 (range 7.2-9.6). Kinnan 7.2, Tayam 7.9, Magda 8.9. Tuned and cEDH now overlap more, which is accepted ("some decks are just built to break their bracket").
- **Known limits:** the 6-line cap and the duplicate rule are judgment calls; a combo whose pieces are legal but whose real-world setup is hard (high `manaValueNeeded`, prerequisites) is not discounted for that (the full snapshot keeps those fields if a later pass wants them); the snapshot is a point-in-time copy, so new combos need a refresh run; the Centrality panel's "plan involvement" now sees more combos and was not re-calibrated; Spark bands and spirit-band thresholds are still not re-fitted to the new tiers.

---

## Revision 3.3 — Three-tier reference set, default impact cards, pod impact-list editing (October 12, 2026)

**1. The benchmark is now a three-tier reference set of 209 decks** (was 159 precons and curated lists). Constants renamed: `PRECON_BENCHMARK_SCORES` is now `REFERENCE_SCORES`, `PRECON_BENCHMARK_SPARK` is `REFERENCE_SPARK`, and a parallel `REFERENCE_TIERS` string (`p`/`t`/`c`) plus `REFERENCE_TIER_LABELS` were added. Row order: 0-158 = the old `TRY_A_DECK_OPTIONS` order (153 official precons, 6 curated); 159-188 = 30 EDHREC Bracket 4 average decks; 189-208 = 20 cEDH tournament lists.
- **Tiers:** official precons 153 (Spark median 4.4, max 5.9); tuned 36 = 6 curated + 30 EDHREC Bracket 4 (median 7.5, range 4.8-9.4); cEDH 20 (median 9.0, range 7.1-9.6).
- **cEDH tier:** 20 lists from recent tournaments for the 20 most competitive commanders, pasted by Anthony (Magda and Kefka lists supplied separately; one unknown card on the Kefka list was replaced with a Swamp at his request).
- **Tuned tier:** EDHREC "optimized" (Bracket 4) average decks, fetched from `https://edhrec.com/average-decks/<commander-slug>/optimized` with WebFetch (each came back as 100 cards and BRACKET 4). The 30 commanders cover all 15 archetypes (archetypes assigned by hand): Korvold, Teysa (Aristocrats); Adeline, Chatterfang (Tokens); Derevi (Stax & Control); Teferi Temporal Archmage, Veyran, Niv-Mizzet Parun (Spellslinger); Kaalia (Ramp & Big Creatures); Meren, Muldrotha (Reanimator); Atraxa, Kenrith (Goodstuff); Zedruu, Phelddagrif (Group Hug); Brago, Roon (Blink); Urza, Breya (Artifacts); Ur-Dragon, Krenko, Edgar Markov (Tribal); Zur, Sythis (Enchantments); Tatyova, Omnath, Lord Windgrace (Land); Phenax, Sidisi (Mill); Light-Paws (Voltron). Anthony reviewed and approved the set. Average decks are statistical averages, so creature-heavy ones (Krenko 5.7, Chatterfang 6.1, Edgar 6.3) read low.
- **Not in `TRY_A_DECK_OPTIONS`:** the 50 new decks exist only as scores in the arrays (and as downloadable text/CSV files given to Anthony). They do not feed archetype fingerprints, staples baselines or the "closest precon" match.
- **Percentile wording rewritten.** Everything that said "PodMates benchmark" or "official precons and curated decks" now says "PodMates reference set" and names the three tiers with counts (`referenceSetSummary()`). A new helper pair, `computeTierPlacement` / `describeTierPlacement`, adds "scores higher than X% of the 153 official precons, Y% of the 36 tuned decks, and Z% of the 20 cEDH tournament lists" to the Spark and axis explainers. The overall percentile is now over 209 decks, so a typical precon sits lower than before; the tier sentence is the honest reading.
- **Offsets:** `ARCHETYPE_SPARK_OFFSET` was regenerated over the original 159 precon and curated decks only (not the new tiers, which would contaminate archetype means with tier mix). `TIER_EXPECTED_SPARK` untouched. Archetype and staples baselines still describe precons; the two labels that said "benchmark deck" now say "precon baseline deck".

**2. Default impact cards in Power.** New constants `DEFAULT_IMPACT_CARDS` (28 cards), `IMPACT_PTS_PER_CARD` = 0.25, `IMPACT_PTS_CAP` = 2.0, and `impactCardsInDeck(agg, list)`. `scorePowerLevel(agg, impactList)` adds the points; every existing caller passes no list and gets the default. `analyzeDeck` now sets `agg.deckCardNames` (non-banned cards). **The list is data-driven, not from memory:** non-Game-Changer cards in at least 7 of the 20 cEDH lists, at most 2 of the 30 tuned lists and at most 1 precon: Gemstone Caverns, Mox Amber, Mox Opal, Lotus Petal, Pact of Negation, Mental Misstep, Simian Spirit Guide, Elvish Spirit Guide, Flusterstorm, Ragavan, Mindbreak Trap, Rite of Flame, Cabal Ritual, Borne Upon a Wind, Red Elemental Blast, Pyroblast, Chain of Vapor, Misdirection, Redirect Lightning, Silence, Tainted Pact, Demonic Consultation, Final Fortune, Brain Freeze, Beseech the Mirror, Wishclaw Talisman, Vexing Bauble, Wheel of Fortune. Some overlap the fast-mana, free-interaction and tutor terms already in Power (a mild double count; accepted).
- **Effect:** 4 of the 159 original benchmark decks moved (by 0.1-0.2 Spark); tuned median 7.5 to 7.6 on the 30; cEDH minimum 6.8 to 7.1. Magda 7.8 to 8.4 (Power 6.9 to 8.9), Kinnan 6.8 to 7.1, Tayam 7.4 to 7.5. Kinnan and Tayam were already at Power 9.4; their gap is Consistency/Disruption, which may be fair.
- **Decision (Anthony):** no soft cap or Game Changer taper. "Some decks are just built to break their bracket; we can see that from the scores." Six EDHREC Bracket 4 decks score 9.0 or more (Breya 9.4, Urza 9.2, Teferi 9.1, Derevi, Zur, Kenrith 9.0), overlapping cEDH; that is left visible on purpose.
- **Still open:** Spark bands and the spirit band thresholds are not re-fitted to the new tiers; the engine has no Bracket 5 / cEDH band.

**3. Pod impact-list editing (Build 4, "build then iterate").**
- **Storage:** `pods/{podId}/settings/impactCards` = `{ changes: { <cardKey>: { card, action: 'add'|'remove', reason, by, byName, at, reasonBy, reasonAt } }, updatedAt }`. Only differences from the default are stored, one map entry per card, so two Co-Stewards editing different cards never overwrite each other. `cardKey` = lower-case card name with non-alphanumerics turned into underscores (max 80).
- **Who:** the Steward and Co-Stewards (`leaderId`, `coLeaderIds`) can write; every pod member can read the list and the reasons. `firestore.rules` has a new `match /settings/{settingId}` block (only `impactCards`; changes map at most 70 entries; delete by the Steward only). The page limits are 60 changes, 15 added cards, 280 characters per reason (`PM_LIMITS.impactChanges/impactAdds/impactReason`); **the 15-addition and 280-character limits are page-enforced only**, because rules cannot loop over a map.
- **Safety:** the radar, Spark, bands, percentiles and reference set never read the pod list. The pod list feeds only `computePodView`, shown as a dashed "Pod view" line under the radar (Power and Spark with the pod's list, next to the standard figures) and in the Impact cards window. `impactCleanChanges` ignores malformed entries (a 'remove' of a non-default card, an 'add' of a default card, partial reason-only entries).
- **UI:** an "Impact cards…" button under the radar opens the window: pod picker, a checkbox per card (default plus pod-added), "in this deck" tags, "added by pod"/"removed by pod" tags, a speech-bubble button per changed card opening an optional reason box (a reason opens automatically after a change; Skip is fine), search-and-add via `searchCardsByName`, and a two-click "Reset to the default list". Non-editors see everything read-only. A reason is never required.
- **Cloud functions** (module script): `loadImpactSettings`, `setImpactChange`, `setImpactReason`, `resetImpactSettings`.
- **Not done:** the proposal's "record list versions on scores" is reduced to showing the date the list last changed; there is no per-score version stamp. No change log beyond author and reason on each entry (an undone change leaves no trace).
- **Untested against real Firebase** (rules and cloud calls were exercised only with a stub): publish the rules, then in the Rules Playground try a Steward write, a plain-member write (should fail) and a member read.

**4. Spellbook offline snapshot (built in Revision 3.4, above).** Original plan: Plan: a scheduled GitHub Action produces a compact snapshot (card-name table plus one short list of card numbers per combo, gzipped), embedded in the page, with the live lookup kept optional. `.github/workflows/spellbook-snapshot-probe.yml` is a one-off probe that prints what the export returns and estimates the real size (my unverified guess: 0.35-0.65 MB). Run it once and send the log of the step called "Size estimate".

**Regression run:** all four scripts compile; 159 of 159 precon and curated decks re-scored (only 4 changed, all by impact cards); the 30 tuned and 20 cEDH decks scored with every card recognised; the page was loaded in headless Chromium, analysed a deck, opened the Impact cards window, toggled a card with a stubbed pod, saved a reason and saw the Pod view line; the only console errors were blocked network requests.

---

## Revision 3.2 — Banned cards and the commander in scoring (October 11, 2026)

**Banned cards are left out of scoring.** `analyzeDeck` now removes any card flagged banned (the `b` flag from the embedded list) before it counts anything: tags, fast mana, curve, combos and synergy. The cards are still listed: `agg.bannedCards` and `agg.bannedCount`, the red "Banned cards (left out of the scores)" line in the Bracket panel, the legality check, and a note in the status line. `agg.totalCards` now means scored cards. `recalibrateWithExternalCombos` also ignores banned cards, so a Spellbook combo cannot use one.

**The commander is no longer treated as a drawable library card.** Three changes, all in `analyzeDeck` / the curve:
- A mana-producing commander enters the mana curve with certainty from the turn it can be cast (`isCommander` on the curve contributor), instead of being "drawn" with probability cards-seen / 99.
- `earlyDensity`, `engineRatio` and a new `avgCmcLibrary` are measured over the library (nonland cards minus the commander). `avgCmcLibrary` feeds the curve penalty in `scoreSpeed`. The displayed Avg. CMC, the type table and the raw tag counts still include every card.
- With no commander named or detected, nothing changes.

**Effect on the 159 benchmark decks:** 61 moved by at most 0.1 to 0.5 on one axis (most by 0.1); Spark moved by at most 0.1; no Bracket changed. Two precons hold a banned card (Trade Secrets in Political Puppets, Dockside Extortionist in Mystic Intellect). Adding Mana Crypt and Jeweled Lotus to a deck no longer raises its scores.

## Revision 3.1 — Bracket timing rules (October 11, 2026)

Found in a critical review of the deck evaluation. Other findings from that review, **not yet built** (banned cards and the commander as a library card are now done, see 3.2): the Power axis is mostly a Game Changer count (r = 0.87); Spark has little resolution (80% of benchmark decks fall between 4.0 and 4.99) and was never tested against Chronicles alignment ratings; Versatility is nearly constant; the curated combo list has only 108 entries; card classification is regex-only with no stored tests.

1. **Two-card combos no longer force Bracket 4 automatically.** Wizards allows a two-card combo in Bracket 3 if it can't be assembled and won before turn six. `detectBracket` (engine-script) now asks whether the combo could be online by **turn five** using the deck's own mana model (`earliestComboTurn`, `comboIsEarly`, constant `EARLY_COMBO_BY_TURN = 5`). Online means both pieces fit in one turn's mana, or are cast on consecutive turns, cheapest first. It looks at mana only, not at drawing the pieces, so it errs toward "could happen". Early means Bracket 4; slower means Bracket 3 (even with zero Game Changers). Each combo detail now carries `pieceCosts` (set in `analyzeDeck` and in `recalibrateWithExternalCombos`; keep the two in step).
2. **Extra turns are now checked.** Constants `EXTRA_TURN_B3_AT = 3` and `EXTRA_TURN_B4_AT = 5` are **this app's judgment**, not Wizards' numbers (they only say "a few, never chained or looped"): 3 or more extra-turn cards means at least Bracket 3, 5 or more means Bracket 4. Change them in one place if Anthony disagrees.
3. `detectSpiritBand` counts slower combos (3+ cards, or two cards online after turn five) as a sharpness signal. The Bracket explainer text was updated.
4. **Verified:** Spark and all five axes are unchanged for all 159 benchmark decks. Bracket moved for one deck only (Vampiric Bloodlust: Sanguine Bond + Blood Tribute comes online around turn six, so 4 becomes 3). A 15-mana combo (Palinchron + Vorinclex, Voice of Hunger) is now Bracket 3; Thassa's Oracle + Demonic Consultation, Kiki-Jiki + Zealous Conscripts and Isochron Scepter + Dramatic Reversal stay Bracket 4.
5. **Not tested:** the page in a real browser (only the engine, run headlessly in Node).
6. Bracket rules were checked against a third-party summary of Wizards' text (still labelled beta, last structural update October 21, 2025, Game Changers additions February 9, 2026). Re-check Wizards' own page before relying on exact wording.

---

## Revision 2 summary — what changed since the first compile (October 3, 2026)

Everything below is described in detail in the sections it points to. If you read only one block of this document before touching the code, read this one.

1. **Spark is now a quiet secondary readout** under the radar, with an explainer popup showing its live weights table (Section 6). Weights live in one shared constant, `SPARK_WEIGHTS`, used by both the formula and the popup. Percentiles are relabeled "PodMates benchmark percentile" (Section 3.6).
2. **Deck Crafter search was rewritten**: ranked results (exact match, then prefix, staples first, one-word names first) plus an Archidekt-style color-identity filter (Section 6).
3. **The card database schema grew from 8 to 10 fields** (`pm` mana produced, `rt` one-shot flag). The weekly rebuild script now computes them, and a shared logic block in both the script and the app derives them from card text (Sections 3.1, 3.5, 4.1). This fixed the broken Mana Base: Cost vs. Production panel (Section 8.6).
4. **Copy-limit cards** (Relentless Rats, Nazgûl, etc., 13 as of Oct 2026) are now handled in Structure & Legality, read from card text (Section 6).
5. **Benchmark tables were regenerated** against the current engine and card data (Section 3.6).
6. **A parser-based security sweep** found and fixed two real issues (Section 8.9).
7. **Size caps** now exist in the page and in the Firestore rules (Sections 3.8, 5.1).
8. **Commander Centrality** is a new panel: a 100-tile heat grid, a band, plain-English reasons, and support bars against a typical deck of the same archetype (Section 6). This is the build of the "commander-dependency" idea from the AI reviews.
9. **Commander names are parsed in one place** (`parseCommanderField` / `resolveCommanderName`), fixing two-faced commanders (Sections 3.7, 8.7).
10. **Load a Deck can no longer hang** on a stalled network step, and the size-cap checks fail open (Section 8.10).
11. **Live Gathering updates**: invites, charted battles, rating surveys and seat changes now arrive in about a second via Firestore listeners, with the old 8-second polling kept as a fallback (Section 6).
12. Smaller: the Clear button is an eraser, End Gathering warns that an unlogged battle will be lost, the commander-support baselines are per archetype.

**File delivery convention (Anthony's workflow):** Claude delivers complete files; Anthony uploads them to GitHub himself and adds his own Firebase/Cloudflare wiring. `index.html` goes in the repo root, `build-card-db.mjs` goes in `.github/scripts/`, and `firestore.rules` is pasted into the Firebase console (it is not deployed from the repo).

---

## 1. What PodMates Is

PodMates (internal/legacy name: **Deck Compass**) is a single-file, offline-capable web app for Magic: The Gathering Commander players. It does two things:

1. **Analyzes a single decklist** — paste or import a decklist, get a five-axis scoring profile (Speed, Consistency, Versatility, Disruption, Power Level), a composite "Command Spark" score, Bracket signals, synergy/combo detection, mana curve analysis, **Commander Centrality** (how built-around its commander the deck is), and more.
2. **Coordinates a regular playgroup ("Pod")** — shared deck ledgers, "Gatherings" (game nights) with live seat assignment and post-game Chronicles (fun/alignment feedback, not just win/loss), player and pod profiles.

**Live URL:** `https://anf1978.github.io/PodMates/`
**Repo:** `https://github.com/anf1978/PodMates`
**Owner/developer:** Anthony ("Archer") — not a professional web developer; wants plain-language explanations, no assumed background.

Four independent AI reviews (details in Section 10) have now converged, unprompted, on the same strategic conclusion: **the Pod/social layer is the actual product; the single-deck scoring engine is the front door.** This should inform prioritization going forward — see Section 11.

---

## 2. Architecture Overview

### 2.1 It's one HTML file
Everything — markup, styling, and all application logic — lives in a single `index.html` file, currently **~3.9 MB**. This is a deliberate choice made before this session, for simplicity and zero-build-step deployment. There is no bundler, no package.json, no build pipeline for the app itself (the data pipelines described in Section 4 are the one exception, and they run entirely inside GitHub Actions, never locally).

### 2.2 Script tag structure (as of this session's end)
Five `<script>` blocks, in this order:

| Script | ID | Approx. lines | Contents |
|---|---|---|---|
| 1 | `engine-script` | ~1450–4070 | Core scoring engine: `classifyCard`, `castabilityWeight`, axis scoring functions (`scoreSpeed`, `scoreConsistency`, etc.), `computeSpark`, synergy/interaction detection, Bracket detection, `deriveManaProduction` and the shared mana-production block (Section 3.5), `parseCommanderField` / `resolveCommanderName` (Section 3.7), `COMMANDER_RULES`, `computeCommanderCentrality` (Section 6) |
| 2 | `lookup-script` | ~4071–4268 | Card database decompression (`decompressCardDB`), fuzzy name matching, `buildLookupIndexes` |
| 3 | `data-script` | ~4269–4281 | **A comment header documenting the tuple schema, then one long line**: `const CARD_DB_COMPRESSED_B64 = "..."` — the entire compressed card database as one ~2.7 MB base64 string |
| 4 | `app-script` | ~4282–27172 | The bulk of the application: UI rendering, deck management (save/load/delete), Deck Crafter, OCR scanning, Pod/Gathering/Chronicles features, `COMMANDER_TIER_DATA` (also a single long line, uncompressed JSON array) |
| 5 | `<script type="module">` | ~27196–28170 | Firebase: auth, Firestore reads/writes, all cloud functions, exposed as `window.PodmatesCloud` |

**Critical gotcha for future editing:** scripts 3 and app-script's `COMMANDER_TIER_DATA` declaration are each a **single line, millions of characters long**. Any `grep`, `view`, or `sed` command that doesn't exclude or carefully bound around these lines will dump megabytes of base64/JSON into context — this happened twice this session and was expensive both times. **Always find line numbers first with `grep -n "pattern" file | cut -d: -f1`** (never let grep print the matched line itself near these two locations), and never use `sed -n 'N,Mp'` across a range you haven't confirmed doesn't include line ~3760 (card DB) or the `COMMANDER_TIER_DATA` line (~3103 as of this session, but **verify fresh** — it shifts whenever either database is rebuilt or other code changes).

### 2.3 Module boundary quirk
The classic scripts (1–4) share global scope with each other and attach their top-level `function` declarations to `window` automatically (standard browser behavior for non-module scripts). The Firebase script (5) is `type="module"` and does **not** share that scope automatically — it must reference anything from the classic scripts via `window.functionName`. This was load-bearing this session when wiring `addLinkedDeck` (module scope) to call `generateUniqueDeckName` (classic scope) — had to use `window.generateUniqueDeckName(...)`.

**Addition (Revision 2):** a top-level `const` in a classic script is visible to other scripts by name but is **not** a property of `window`. Anything the module script needs is therefore attached explicitly. The size-limit table is `window.PM_LIMITS` (declared in app-script, read by the module as `window.PM_LIMITS`), and the module's `PodmatesCloud` object is how the page reaches Firebase.

### 2.4 Hosting & deployment
- **GitHub Pages**, serving directly off the `main` branch. Pushing to `main` triggers a redeploy, which typically takes 1–2 minutes (not instant — this caused confusion once this session when a fix was verified in the repo but the live site hadn't caught up yet).
- No custom build step. What's in `index.html` on `main` is what's live.
- `raw.githubusercontent.com` sits behind its own CDN cache (observed ~5 minute TTL) — useful to know when verifying a just-pushed change via `curl`, since a stale cache hit can look identical to a failed push. Check `x-cache` / `source-age` response headers to tell the difference; GitHub's own file browser is never cached and is the authoritative fast-check.

### 2.5 Backend services
- **Firebase** (Firestore + Auth): accounts, saved decks, linked decks, pods, pod members, Gatherings, Chronicles, table formations. Full current rules in Section 5.1.
- **Cloudflare Workers** (two, both external to this repo's own code — their source isn't stored in `index.html`):
  1. A deck-sync worker that proxies fetches to Moxfield/Archidekt (needed because their APIs require server-side requests with specific headers that a browser can't send directly, and to work around CORS). **This repo does not contain this worker's source** — if it ever needs editing, that source must be requested from Anthony or reconstructed from the calling convention in `fetchDeckByLink` (app-script, calls out to `SYNC_WORKER_URL`).
  2. A Commander Spellbook combo-lookup worker. Source **is** saved — see Section 5.4 (`worker-find-my-combos.js`).
- **Scryfall API**: called directly from the browser for card art (no proxy needed — Scryfall is CORS-enabled for this). Also the source of the entire card database, via its bulk-data endpoint (Section 4.1).
- **Playgroup.gg API**: public, unauthenticated, source of the commander win-rate data (Section 4.2).

### 2.6 Automation (new this session — this is the single biggest architectural change made)
Two GitHub Actions workflows now run **weekly and automatically**, with no human involvement required:
- **Card database rebuild** — Mondays 06:00 UTC
- **Commander win-rate database rebuild** — Mondays 07:00 UTC (deliberately offset so they don't compete for runtime)

Both can also be triggered manually from the repo's Actions tab. Full scripts and workflow YAML in Section 4. **This is the thing most likely to need monitoring** — if either stops running or starts failing, nobody will notice until the data visibly goes stale or (as happened once this session) a bad run silently corrupts the live database. See Section 8 for the incident history and the safety nets now in place.

---

## 3. Data Model Reference

### 3.1 Card database (`CARD_DB`)
Decompressed at page load from `CARD_DB_COMPRESSED_B64` (gzip, then base64). The decompression function (`decompressCardDB`, in lookup-script) expects this exact JSON shape once gzip-decoded:

```json
{
  "cards": [["Card Name", "Type Line", "Oracle text", "{2}{G}{G}", "RG", 4, "G2R2", "rare", "G", 0], ...],
  "gc": ["Game Changer Card Name", ...],
  "banned": ["Banned Card Name", ...]
}
```

Each card tuple maps to an object with this **exact field schema** — memorize this, it was the source of a significant bug this session:

| Index | Field | Meaning | Type |
|---|---|---|---|
| 0 | `n` | Card name | string |
| 1 | `t` | Type line | string |
| 2 | `o` | Oracle text | string |
| 3 | `c` | **Mana cost string** (e.g. `"{2}{G}{G}"`) | string |
| 4 | `ci` | Color identity (e.g. `"RG"`) | string |
| 5 | `m` | **Mana value / CMC** (e.g. `4`) | number |
| 6 | `p` | Pip encoding (see below) | string |
| 7 | `r` | **Rarity** (a word such as `"rare"`; it is NOT a ritual flag, see Section 8.6) | string |
| 8 | `pm` | Colors of mana the card can produce, in `WUBRG` then `C` order (`""` if none; "any color" is stored as `"WUBRG"`) | string |
| 9 | `rt` | `1` if that mana is one-shot only (Dark Ritual, Lotus Petal, Spirit Guides), else `0` | number |

**Revision 2:** fields 8 and 9 were added (earlier databases have only 8). `decompressCardDB` leaves `pm`/`rt` as `undefined` (not `""`) when absent, which is how the app knows to fall back to reading card text (Section 3.5). Two runtime caches are also attached to card objects: `_mp` (derived mana production) and `_copyLimit` (Section 6, Structure & Legality). Plus two computed fields added at decompression time: `g` (is this card a Game Changer — looked up by name against the `gc` list) and `b` (is this card banned in Commander — looked up against the `banned` list).

**`.c` vs `.m` — the single most important thing to get right.** `.c` is a *string* (the mana cost, for display/parsing symbols). `.m` is a *number* (the mana value, for arithmetic). Confusing these was responsible for a 22-location bug this session (detailed in Section 8.1) and a second, related bug in the opposite direction (Section 8.2). Any new code touching card objects must get this right the first time.

**Pip encoding (`.p`)**: a string like `"W2U1"` meaning 2 half-pips of W (= 1 full W pip) and 1 half-pip of U (= 0.5 U pip). Stored as doubled integers specifically so hybrid mana (`{W/U}` = 1 half-pip to each color) doesn't need a decimal point in the string. Consumed via `card.p.match(/[WUBRGC]\d+/g)`, dividing each matched number by 2.

**Dataset size**: as of the last automated rebuild, ~35,445 unique cards (about 2,093 of them produce mana) (one entry per unique Oracle name — Scryfall's bulk file has one row per *printing*, deduplicated during the build).

### 3.2 Commander win-rate data (`COMMANDER_TIER_DATA`)
A plain (uncompressed) JSON array, declared directly as `const COMMANDER_TIER_DATA = [...]`. No gzip, no base64 — much simpler format than the card database.

```json
[{"n": "Commander Name", "t": "S", "w": 43, "g": 778, "r": 1}, ...]
```

| Field | Meaning |
|---|---|
| `n` | Commander name |
| `t` | Tier letter — computed from win rate: S ≥35%, A 30–35%, B 23–30%, C 18–23%, D <18% |
| `w` | Win rate (percentage, e.g. `43` = 43%) |
| `g` | Games tracked |
| `r` | Global rank (from Playgroup.gg directly) |

As of the last rebuild: ~1,273 commanders meeting the inclusion threshold (250+ tracked games **and** 10+ distinct decks — the latter is a proxy for "distinct pilots," since the API doesn't expose true pilot-uniqueness, only deck count).

### 3.3 Firestore structure
```
users/{uid}
  - podIds: [string]
  - displayName, archidektProfileUrl, moxfieldProfileUrl, etc.
  trades/{tradeId}            (PriceScry ledger, Section 14; private to the user)
    - card, key, finish, paper (true = pretend money), qty, buyYen, buyExtraYen, buyDate, shop, tag (riser/spoiler/other), note,
      sells: [{qty, yen, feePct, shipYen, packYen, date...}], markYen, markDate   (validated by cleanTrade in the module script)
  decks/{docId}
    - key, deckName, commander, player, list, secret, savedAt, updatedAt
  linkedDecks/{platform-deckId}
    - platform, deckId, url, name, commander, decklistText, cardCount, addedAt, syncedAt

pods/{podId}
  - leaderId, coLeaderIds, memberIds, name, inviteCode
  members/{uid}
    - displayName, joinedAt
  tableFormations/{formationId}
  chronicles/{entryId}        (participants: [uid], notes, notesEditedBy, feedbackResponses, decks, gatheringTitle)
  gatherings/{gatheringId}
```

### 3.4 Deck entry schema — the "name" architecture (new this session)
Every saved deck now has a `deckName` field, enforced unique per-account (manual saves and linked decks share one name pool). This is a genuinely new layer on top of the older "key" system:

- **`key`** — a Firestore *field* (not necessarily the document ID!) storing a human-readable identifier. For an ordinary manual save, `key === docId`. For a linked deck's mirror, they're deliberately different.
- **`docId`** — the actual Firestore document ID. For manual saves, same as `key`. For a linked deck's mirror, always `linked-{platform}-{deckId}` — a stable ID that survives the deck being renamed on the source platform.
- **`deckName`** — the new, user-facing, enforced-unique display name. Defaults to `"{Commander} ({Player})"` for manual saves, or the source platform's own deck title for linked decks, but is independently editable.

**The rule any new code must follow**: when displaying or deleting a deck, use `docId` for anything that needs to reliably address the *document* (deletion, updates), and `deckName` (falling back to `key` for legacy decks saved before this field existed) for anything user-facing. Never assume `key === docId` — that was exactly the bug in Section 8.3.

### 3.5 Mana production data (`pm`, `rt`) — added in Revision 2

**What it is.** For every card, `pm` lists the colors of mana it can make and `rt` says whether that mana is one-shot. The Mana Base: Cost vs. Production panel reads these.

**Where the logic lives, and the rule that it must stay identical.** The logic is two functions, `analyzeManaFace(typeLine, oracleText)` and `combineManaFaces(results)`, in a block fenced by `===== BEGIN SHARED MANA-PRODUCTION LOGIC =====` / `===== END ... =====` comments. The block exists in **two places**: `.github/scripts/build-card-db.mjs` (computes the values when the database is built) and `index.html`'s engine-script (the fallback for a database without the fields). It was verified byte-identical. If you change one, change the other, then diff the two fenced blocks.

**What counts as production.**
- Only real mana abilities: `{cost}: Add ...` on a permanent, `Add ...` on an instant/sorcery, and Aura wording like Wild Growth's. Treasure/Eldrazi Spawn/Powerstone makers, abilities granted to other permanents (text in "quotes"), reminder text (in parentheses, except on lands where it is the only statement of the ability) and mana doublers all correctly count as nothing.
- **One-shot** (`rt = 1`): instants and sorceries, or abilities whose cost is "sacrifice this" or "exile this card from your hand". A card with both a sustained and a one-shot ability (Crystal Vein) counts as a normal source of its sustained colors.
- Basic land types carry an intrinsic ability (Dryad Arbor, Jasconian Isle). This is skipped on combined `A // B` type lines.
- **Faces:** the build script unions the faces of `modal_dfc`, `split` and `adventure` layouts (so Pathway lands count both colors and spell-or-land cards count as a source); `transform` and other layouts use the front face only. The in-app fallback only sees the first face's text.

**In the app.** `deriveManaProduction(card)` uses `card.pm`/`card.rt` when `card.pm` is a string, otherwise it analyzes `card.t`/`card.o`. It caches on `card._mp`. `analyzeDeck` then counts a colored source only for colors the deck can cast (`deckColorIdentity`: the commander's identity when known, else the colors on the deck's nonland cards), so Birds of Paradise is not a red source in a mono-green deck. Colorless production is shown as its own note unless the deck has actual `{C}` costs (otherwise Sol Ring would shrink every color's share). The "not counted" list holds genuine one-shots only.

**Known limits.** About 14 odd cards are still missed (charge-counter style producers, a few Un-cards). The first real Scryfall rebuild after this change reported 2,093 producers (the synthetic test file gave 2,043, the difference being real multi-face cards).

### 3.6 Reference set and baseline tables (precomputed, so they can go stale)

These constants were computed **offline** by running the real engine over the reference decks (the 159 `TRY_A_DECK_OPTIONS` decks plus 30 EDHREC Bracket 4 average decks and 20 cEDH tournament lists, Revision 3.3). They do not update themselves. When the scoring engine or the card data changes (for instance the Game Changers list or the default impact cards, which feed Power Level), they drift. Regenerate every row whenever Power changes.

| Constant | What it is | State |
|---|---|---|
| `REFERENCE_SCORES` | five axis scores per reference deck (209 rows: rows 0-158 in `TRY_A_DECK_OPTIONS` order, then 30 tuned, then 20 cEDH) | Regenerated Oct 12, 2026 (after Revision 3.4: impact cards and Spellbook combos on) |
| `REFERENCE_TIERS` | one letter per row: `p` precon, `t` tuned, `c` cEDH | Oct 12, 2026 |
| `REFERENCE_SPARK` | Spark per reference deck (same order). Drives the Spark percentile and tier placement. | Regenerated Oct 12, 2026 |
| `ARCHETYPE_SPARK_OFFSET` | mean Spark of each archetype minus the all-deck mean over the original 159 decks only, 2 decimals | Regenerated Oct 12, 2026 |
| `PRECON_FINGERPRINTS` | per-deck feature vectors for archetype matching (one ~54 KB line) | **Slightly drifted, not refreshed**: 50 of 159 differ by up to 0.05 on a component. Could flip a borderline archetype match. |
| `TIER_EXPECTED_SPARK` | expected Spark band per win-rate tier | Calibrated against real win rates, not the corpus. Leave alone. |
| `CENTRALITY_SUPPORT_BASELINE`, `CENTRALITY_SUPPORT_BASELINE_BY_ARCHETYPE` | median count of protection / recursion / tutor / cost-reducer / equipment-and-Aura cards in a typical deck, all-deck and per archetype | Computed Oct 3, 2026. An archetype with 8 or more decks uses its own median, 4–7 decks blend half toward the all-deck figure, fewer than 4 use the all-deck figure. |
| `CENTRALITY_TERM_BASELINE` | median share of a deck's nonland cards matching each theme term (artifacts, tokens, graveyard...) | Computed Oct 3, 2026 |

**Percentile wording.** The reference set is 153 precons, 36 tuned decks and 20 cEDH lists, not all of Commander, so the UI says "percentile of the PodMates reference set", the caption under the radar names the three tiers with counts, and the explainers add a per-tier sentence. Do not reword this back to "percentile of Commander".

**Regenerating.** See Section 13: load the real engine headlessly, run every benchmark deck through parse, match, `analyzeDeck`, the five scorers and `computeSpark`, write the arrays back (keeping the 209-row order and the tier string), then re-run the comparison and require the 159 original decks identical except where the change is intended.

### 3.7 Commander names: one parser, one resolver (Revision 2)

A two-faced commander is **one card** whose name is `"Front // Back"`. The old code split the Commander box on every slash, producing two "commanders" and a false "this pairing likely isn't legal" warning (Section 8.7). Now:

- `resolveCommanderName(name, matchedCards)` finds the real card for a name however it was typed: the full name, the front face only, any capitalization, curly or straight apostrophes, or `A / B` for a two-faced card. It looks in the deck's matched cards first, then in `CARD_DB`.
- `parseCommanderField(raw, matchedCards)` turns the box's text into canonical card names. It first tries the whole string as one card, then splits on a single `/` or ` & ` (real partner pairs) and never on `//`.
- Both are used by `runAnalysis`, pod/profile analysis, `checkLegality`, the `analyzeDeck` color-identity logic and `computeCommanderCentrality`. Any new code that needs "the commander card" should call these, not compare `card.n === name`.

### 3.8 Size limits (Revision 2)

One table, `window.PM_LIMITS` (in app-script), used by the page and read by the module script:

| Group | Limits |
|---|---|
| Text length | display name 40, player name 40, pod name 60, Gathering title 80, lineup name 60, deck name 200, commander name 150, deck key 300, profile link 200, deck link 300, chronicle notes 500, best moment 280 |
| One decklist | 30,000 characters and 600 lines (a normal 100-card list is about 3,000 characters) |
| Counts | 150 saved decks, 25 linked decks, 10 pods per account, 30 members per pod, 30 lineups per pod, 1,000 chronicles per pod; per chronicle 6 decks, 12 participants; 24 feedback responses; Deck Crafter 300 distinct cards, 99 copies of one card |

**How they behave.** Text boxes get `maxLength` the first time they are focused (`PM_INPUT_LIMIT_KEYS` maps box ids to limits). The decklist box is deliberately **not** truncated: a long paste gets a message with the size and the limit, because silently chopping could save half a deck. Text a person typed is rejected with a clear message; text copied from elsewhere (a Google account name, a Moxfield title) is trimmed. Overwriting an existing deck, lineup or linked deck never counts against a count limit. Backup restore stops at the deck limit and reports how many were skipped or failed.

**Where enforced.** Page and module enforce everything above. The Firestore rules (Section 5.1) enforce only text lengths, list sizes and decklist size, each set slightly **looser** than the page so older data is never blocked. Rules cannot count documents, so the count limits are page-only. The count/exists checks in the module **fail open** (a 6-second timeout, then the save proceeds) so a slow network cannot hang a save.

---

## 4. Automated Data Pipelines — Full Reference

### 4.1 Card database rebuild
**Runs:** Mondays 06:00 UTC, or manually via Actions tab.
**Files:** `.github/workflows/rebuild-card-database.yml`, `.github/scripts/build-card-db.mjs`, `.github/scripts/splice-card-db.mjs`

**What it does:** fetches Scryfall's current Oracle Cards bulk data (looked up fresh each run via `https://api.scryfall.com/bulk-data/oracle-cards`, since the actual download URL is timestamped and changes constantly), decompresses it (Scryfall serves this gzip-compressed — this was the root cause of the one real production incident this session, see Section 8.4), transforms each card into the tuple schema above, pulls Game Changer and banned status **directly from Scryfall's own per-card fields** (no manual curation needed), and splices the result into `index.html`.

**Safety net:** refuses to write any output at all if the resulting card count is outside 5,000–∞ (effectively: below 5,000 means something went wrong upstream and the run fails loudly, rather than silently committing a broken or empty database over a working one). This did not exist on the first run and should have — the first run silently committed an empty database to the live site. It exists now. **Revision 2 added a second check**: it also refuses to write if fewer than 800 cards are detected as mana producers (the real figure is about 2,000; the first real run after the change reported 2,093). A failure of the production logic would otherwise empty the Mana Base panel without any error.

```javascript
// .github/workflows/rebuild-card-database.yml
name: Rebuild Card Database

on:
  workflow_dispatch: {}
  schedule:
    - cron: '0 6 * * 1'

permissions:
  contents: write

jobs:
  rebuild:
    runs-on: ubuntu-latest
    steps:
      - name: Check out the repo
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Look up the current Scryfall Oracle Cards download URL
        run: |
          curl -s https://api.scryfall.com/bulk-data/oracle-cards -o bulk-meta.json
          BULK_URL=$(jq -r '.jsonl_download_uri' bulk-meta.json)
          echo "Resolved download URL: $BULK_URL"
          echo "BULK_URL=$BULK_URL" >> "$GITHUB_ENV"

      - name: Download the current card data
        run: curl -s -L "$BULK_URL" -o scryfall-bulk.jsonl

      - name: Build the compressed database
        run: node .github/scripts/build-card-db.mjs scryfall-bulk.jsonl new-card-db.b64

      - name: Splice it into index.html
        run: node .github/scripts/splice-card-db.mjs index.html new-card-db.b64

      - name: Commit the refreshed database, if it changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add index.html
          git diff --staged --quiet && echo "No change -- nothing to commit." || (git commit -m "Automated card database refresh" && git push)
```

```javascript
// .github/scripts/build-card-db.mjs   (Revision 2: 10-field tuple, shared mana-production block, producer sanity check)
// PodMates card database builder -- reverse-engineered from the app's own
// decompressCardDB() function, since the original build script no longer
// exists anywhere accessible. Produces the exact payload shape and gzip
// compression that function expects.
//
// Usage: node build-card-db.mjs <path-to-scryfall-bulk-file> [output-file]
// Handles the input whether it's gzip-compressed or plain text -- Scryfall
// serves its bulk data pre-gzipped (a .jsonl.gz download), which the first
// version of this script didn't account for: it read the compressed bytes
// as if they were already plain text, every line failed to parse, and it
// silently produced an empty database instead of erroring. Detecting the
// gzip magic bytes and decompressing when present fixes that regardless of
// how this script gets invoked or whether Scryfall's serving format changes.
//
// Card tuple (10 fields):
//   [name, typeLine, oracleText, manaCost, colorIdentity, manaValue, pips,
//    rarity, producedMana, oneShotFlag]
// The last two are what the Mana Base: Cost vs. Production panel needs:
//   producedMana - colors of mana the card can make ("" if none), e.g. "WG"
//   oneShotFlag  - 1 if that mana is one-time only (Dark Ritual, Lotus Petal),
//                  so it's listed separately instead of counted as a source
// An earlier build left these out entirely and the panel read other fields
// (mana value, rarity) in their place, which broke it. They are worked out
// here from each card's rules text -- see the shared block below.

import { readFileSync, writeFileSync } from 'fs';
import { gzipSync, gunzipSync } from 'zlib';

const MIN_PLAUSIBLE_CARD_COUNT = 5000;
// The real figure is ~2,000 cards that produce mana. If far fewer come out,
// the production logic has broken (the way the gzip bug once produced zero
// cards) -- fail loudly rather than publish a database that empties the panel.
const MIN_PLAUSIBLE_PRODUCER_COUNT = 800;

// ===== BEGIN SHARED MANA-PRODUCTION LOGIC =====
// This block is IDENTICAL in two places and must stay that way:
//   1. .github/scripts/build-card-db.mjs  (computes the values at database-build time)
//   2. index.html, engine-script          (fallback for a database built before these fields existed)
// Scryfall has no "what mana does this make" field that separates real mana
// abilities from Treasure/token makers, and no "one-shot ritual" concept at
// all, so both are worked out from a card's type line and rules text.
//
// analyzeManaFace(typeLine, oracleText) returns the colors a single card face
// can add, split into two groups:
//   sustained - a permanent ability it can use again and again
//               (lands, rocks, dorks, Signets, Wild Growth-style Auras)
//   oneShot   - mana it makes only once (instants/sorceries like Dark Ritual,
//               or "sacrifice this" / "exile from hand" abilities like Lotus
//               Petal and the Spirit Guides)
// Colors come back in WUBRGC order. "Any color" becomes WUBRG, "any type"
// adds C. Only real mana abilities count: Treasure/Spawn/Powerstone makers,
// abilities granted to other permanents ("quoted" text), reminder text, and
// mana doublers all correctly produce nothing.
const MANA_ORDER = 'WUBRGC';
function canonManaColors(colorSet) {
  let out = '';
  for (const c of MANA_ORDER) if (colorSet.has(c)) out += c;
  return out;
}
function analyzeManaFace(typeLine, oracleText) {
  const tl = String(typeLine || '').toLowerCase();
  const isLand = /\bland\b/.test(tl);
  const isSpell = /\b(instant|sorcery)\b/.test(tl);
  const isAura = /\baura\b/.test(tl);
  let text = String(oracleText || '');
  // Reminder text in (parentheses) explains rules; it is not the card's own
  // ability -- except on lands, where "({T}: Add {G}.)" can be the only place
  // the ability is written.
  if (!isLand) text = text.replace(/\([^)]*\)/g, '');
  // Text in "quotes" is an ability granted to a token or another permanent.
  text = text.replace(/["\u201C][^"\u201D]*["\u201D]/g, '');

  const sustained = new Set(), oneShot = new Set();
  const oneShotCost = /sacrifice (this|it)\b|exile (this card|it) from your hand/i;
  const ANY_COLOR = /\bany (one )?(color|type)\b|any combination of colors|different colors|of that color|chosen color|any of (those|the exiled card's|the|this [a-z]+'s) colors?|each color among/i;

  const absorb = (clause, set) => {
    const symRe = /\{([WUBRGC])\}|\{([WUBRG])\/([WUBRG])\}/g;
    let m;
    while ((m = symRe.exec(clause))) {
      if (m[1]) set.add(m[1]); else { set.add(m[2]); set.add(m[3]); }
    }
    if (ANY_COLOR.test(clause)) {
      for (const c of 'WUBRG') set.add(c);
      if (/\bany type\b/i.test(clause)) set.add('C');
    }
  };

  for (const line of text.split('\n')) {
    const addRe = /\badd\s+([^.]*)/gi;
    let m;
    if (isSpell) {
      while ((m = addRe.exec(line))) absorb(m[1], oneShot);
      continue;
    }
    const colon = line.indexOf(':');
    if (colon !== -1) {
      const cost = line.slice(0, colon), effect = line.slice(colon + 1);
      const target = oneShotCost.test(cost) ? oneShot : sustained;
      while ((m = addRe.exec(effect))) absorb(m[1], target);
    } else if (isAura) {
      // Wild Growth / Utopia Sprawl / Fertile Ground: the Aura adds mana when
      // the enchanted land is tapped.
      const aura = /enchanted [a-z]+ is tapped for mana[^.]*?\badds?\s+([^.]*)/i.exec(line);
      if (aura) absorb(aura[1], sustained);
    }
  }
  // Basic land types carry an intrinsic mana ability (Dryad Arbor, Jasconian
  // Isle, Snow-Covered basics, "Forest Dryad"...). Skipped on combined
  // "A // B" type lines, where the subtype could belong to the other face.
  if (isLand && !tl.includes('//')) {
    const dash = tl.indexOf('\u2014');
    const sub = dash === -1 ? '' : tl.slice(dash + 1);
    if (/\bplains\b/.test(sub)) sustained.add('W');
    if (/\bisland\b/.test(sub)) sustained.add('U');
    if (/\bswamp\b/.test(sub)) sustained.add('B');
    if (/\bmountain\b/.test(sub)) sustained.add('R');
    if (/\bforest\b/.test(sub)) sustained.add('G');
  }
  return { sustained: canonManaColors(sustained), oneShot: canonManaColors(oneShot) };
}
// Combines one or more faces of a card into the two values the database
// stores: pm = colors it can produce, rt = 1 if that production is one-shot only.
// A card that has BOTH a sustained and a one-shot ability (Crystal Vein) counts
// as a normal source of its sustained colors.
function combineManaFaces(faceResults) {
  const s = new Set(), o = new Set();
  for (const r of faceResults) {
    for (const c of r.sustained) s.add(c);
    for (const c of r.oneShot) o.add(c);
  }
  if (s.size) return { pm: canonManaColors(s), rt: 0 };
  if (o.size) return { pm: canonManaColors(o), rt: 1 };
  return { pm: '', rt: 0 };
}
// ===== END SHARED MANA-PRODUCTION LOGIC =====

// Faces whose abilities are all usable from the same card. Modal double-faced
// cards (spell // land), split cards and adventures can be played as either
// half, so their production is combined. Transforming cards only reach their
// back face after transforming, so only the front face counts for those.
const UNION_FACE_LAYOUTS = new Set(['modal_dfc', 'split', 'adventure']);

function manaProductionFor(card) {
  const faces = (card.card_faces && card.card_faces.length) ? card.card_faces : null;
  if (!faces) return combineManaFaces([analyzeManaFace(card.type_line, card.oracle_text)]);
  const used = UNION_FACE_LAYOUTS.has(card.layout) ? faces : [faces[0]];
  return combineManaFaces(used.map(f => analyzeManaFace(f.type_line || card.type_line, f.oracle_text)));
}

function encodePips(manaCost) {
  if (!manaCost) return '';
  const halfPips = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const symbolRe = /\{([^}]+)\}/g;
  let match;
  while ((match = symbolRe.exec(manaCost))) {
    const sym = match[1];
    if (sym === 'C') { halfPips.C += 2; continue; }
    const colors = sym.split('/').filter(s => 'WUBRG'.includes(s));
    if (!colors.length) continue;
    const share = 2 / colors.length;
    for (const c of colors) halfPips[c] += share;
  }
  let out = '';
  for (const c of ['W', 'U', 'B', 'R', 'G', 'C']) {
    const v = Math.round(halfPips[c]);
    if (v > 0) out += c + v;
  }
  return out;
}

function cardToTuple(card) {
  const face = (card.card_faces && card.card_faces.length) ? card.card_faces[0] : card;
  const name = card.name || '';
  const typeLine = card.type_line || face.type_line || '';
  const oracleText = card.oracle_text || face.oracle_text || '';
  const manaCost = card.mana_cost || face.mana_cost || '';
  const colorIdentity = (card.color_identity || []).join('');
  const cmc = typeof card.cmc === 'number' ? card.cmc : 0;
  const pips = encodePips(manaCost);
  const rarity = card.rarity || '';
  const { pm, rt } = manaProductionFor(card);
  return [name, typeLine, oracleText, manaCost, colorIdentity, cmc, pips, rarity, pm, rt];
}

function readInputAsText(path) {
  const buf = readFileSync(path);
  const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  const raw = isGzip ? gunzipSync(buf) : buf;
  return { text: raw.toString('utf8'), wasGzipped: isGzip };
}

function build(bulkFilePath, outPath) {
  const { text, wasGzipped } = readInputAsText(bulkFilePath);
  console.log(wasGzipped ? 'Input was gzip-compressed -- decompressed before parsing.' : 'Input was plain text.');

  const cards = [];
  const gc = [];
  const banned = [];
  const seenNames = new Set();

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const trimmed = rawLine.trim().replace(/,$/, '');
    if (!trimmed || trimmed === '[' || trimmed === ']') continue;
    let card;
    try { card = JSON.parse(trimmed); } catch (e) { continue; }
    if (!card || card.object !== 'card') continue;
    if (card.layout === 'token' || card.layout === 'art_series') continue;
    if (seenNames.has(card.name)) continue;
    seenNames.add(card.name);

    cards.push(cardToTuple(card));
    if (card.game_changer === true) gc.push(card.name);
    if (card.legalities && card.legalities.commander === 'banned') banned.push(card.name);
  }

  if (cards.length < MIN_PLAUSIBLE_CARD_COUNT) {
    throw new Error(`Only parsed ${cards.length} cards, expected at least ${MIN_PLAUSIBLE_CARD_COUNT}. Refusing to write output.`);
  }
  const producerCount = cards.filter(t => t[8]).length;
  const oneShotCount = cards.filter(t => t[9] === 1).length;
  if (producerCount < MIN_PLAUSIBLE_PRODUCER_COUNT) {
    throw new Error(`Only ${producerCount} cards were detected as mana producers, expected at least ${MIN_PLAUSIBLE_PRODUCER_COUNT}. Refusing to write output.`);
  }

  const payload = { cards, gc, banned };
  const json = JSON.stringify(payload);
  const gzipped = gzipSync(Buffer.from(json, 'utf8'));
  const b64 = gzipped.toString('base64');

  writeFileSync(outPath, b64, 'utf8');
  return { cardCount: cards.length, gcCount: gc.length, bannedCount: banned.length, producerCount, oneShotCount, b64Length: b64.length };
}

const [, , bulkFilePath, outPath] = process.argv;
if (!bulkFilePath) {
  console.error('Usage: node build-card-db.mjs <scryfall-bulk-file> [output-file]');
  process.exit(1);
}
try {
  const stats = build(bulkFilePath, outPath || 'card-db-compressed.b64');
  console.log('Build complete:', stats);
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
```

```javascript
// .github/scripts/splice-card-db.mjs
// Replaces the CARD_DB_COMPRESSED_B64 line in index.html with a freshly
// built value, leaving every other byte of the file untouched. Matched by
// its declaration prefix rather than a hardcoded line number.
import { readFileSync, writeFileSync } from 'fs';

const [, , indexHtmlPath, newB64Path, outPath] = process.argv;
if (!indexHtmlPath || !newB64Path) {
  console.error('Usage: node splice-card-db.mjs <index.html> <new-b64-file> [output-path]');
  process.exit(1);
}

const html = readFileSync(indexHtmlPath, 'utf8');
const newB64 = readFileSync(newB64Path, 'utf8').trim();

const PREFIX = 'const CARD_DB_COMPRESSED_B64 = "';
const startIdx = html.indexOf(PREFIX);
if (startIdx === -1) throw new Error('Could not find CARD_DB_COMPRESSED_B64 declaration -- aborting rather than guessing.');
const valueStart = startIdx + PREFIX.length;
const endIdx = html.indexOf('";', valueStart);
if (endIdx === -1) throw new Error('Could not find the closing quote -- aborting rather than guessing.');

const before = html.slice(0, valueStart);
const after = html.slice(endIdx);
const spliced = before + newB64 + after;

writeFileSync(outPath || indexHtmlPath, spliced, 'utf8');
console.log('Spliced. Old value length:', endIdx - valueStart, 'New value length:', newB64.length);
```

### 4.2 Commander win-rate database rebuild
**Runs:** Mondays 07:00 UTC, or manually.
**Files:** `.github/workflows/rebuild-winrate-database.yml`, `.github/scripts/build-winrate-db.mjs`, `.github/scripts/splice-winrate-db.mjs`

**What it does:** Playgroup.gg has **no bulk/list endpoint** — only `GET /commanders/{id}`, a per-ID lookup. This script scans IDs sequentially from 1, respecting Playgroup's stated rate limit (confirmed via their own API docs: 400 requests/minute with a descriptive User-Agent header; they've explicitly said bulk scanning this way is fine as long as requests identify themselves). It stops once it hits 300 consecutive misses (confident it's passed the highest assigned ID), keeps only commanders clearing the 250-games/10-decks threshold, computes tier from the documented S/A/B/C/D win-rate bands, and writes the result as a plain JS array statement.

**Safety net:** same philosophy as the card database — refuses to write output if the final count falls outside 500–5,000 (the real number has consistently been ~1,200–1,400).

```javascript
// .github/workflows/rebuild-winrate-database.yml
name: Rebuild Commander Win-Rate Database

on:
  workflow_dispatch: {}
  schedule:
    - cron: '0 7 * * 1'

permissions:
  contents: write

jobs:
  rebuild:
    runs-on: ubuntu-latest
    steps:
      - name: Check out the repo
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build the win-rate database
        run: node .github/scripts/build-winrate-db.mjs new-winrate-data.js

      - name: Splice it into index.html
        run: node .github/scripts/splice-winrate-db.mjs index.html new-winrate-data.js

      - name: Commit the refreshed database, if it changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add index.html
          git diff --staged --quiet && echo "No change -- nothing to commit." || (git commit -m "Automated commander win-rate refresh" && git push)
```

```javascript
// .github/scripts/build-winrate-db.mjs
// PodMates commander win-rate database builder. Playgroup.gg's public API
// only offers a per-ID lookup (GET /commanders/{id}), not a bulk/list
// endpoint. Playgroup have explicitly said bulk access via ID scanning is
// fine, as long as requests identify themselves with a descriptive
// User-Agent, which this respects along with their stated rate limit.

import { writeFileSync } from 'fs';

const API_BASE = 'https://playgroup.gg/api/public/v1';
const USER_AGENT = 'PodMates/1.0 (+https://github.com/anf1978/PodMates; MTG Commander deck analysis tool)';
const REQUESTS_PER_MINUTE = 250;
const DELAY_MS = Math.ceil(60000 / REQUESTS_PER_MINUTE);
const CONSECUTIVE_MISS_LIMIT = 300;
const MIN_GAMES = 250;
const MIN_DECKS = 10;
const MIN_PLAUSIBLE_COUNT = 500;
const MAX_PLAUSIBLE_COUNT = 5000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function tierFor(winRate) {
  if (winRate >= 35) return 'S';
  if (winRate >= 30) return 'A';
  if (winRate >= 23) return 'B';
  if (winRate >= 18) return 'C';
  return 'D';
}

async function fetchCommander(id) {
  const res = await fetch(`${API_BASE}/commanders/${id}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
  });
  if (res.status === 404) return null;
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
    console.log(`Rate limited, waiting ${retryAfter}s before retrying id ${id}...`);
    await sleep(retryAfter * 1000);
    return fetchCommander(id);
  }
  if (!res.ok) throw new Error(`Unexpected status ${res.status} for commander id ${id}`);
  return res.json();
}

async function build(outPath) {
  const results = [];
  let consecutiveMisses = 0;
  let id = 1;
  let checked = 0;

  while (consecutiveMisses < CONSECUTIVE_MISS_LIMIT) {
    const card = await fetchCommander(id);
    checked++;
    if (!card) {
      consecutiveMisses++;
    } else {
      consecutiveMisses = 0;
      const stats = card.stats || {};
      if ((stats.games_count || 0) >= MIN_GAMES && (stats.decks_count || 0) >= MIN_DECKS) {
        results.push({
          n: card.name, t: tierFor(stats.win_rate), w: stats.win_rate,
          g: stats.games_count, r: card.global_rank,
        });
      }
    }
    id++;
    await sleep(DELAY_MS);
    if (checked % 200 === 0) console.log(`Checked ${checked} ids (up to ${id - 1}), ${results.length} qualifying so far...`);
  }

  console.log(`Stopped after ${CONSECUTIVE_MISS_LIMIT} consecutive misses, highest id checked: ${id - 1}`);

  if (results.length < MIN_PLAUSIBLE_COUNT || results.length > MAX_PLAUSIBLE_COUNT) {
    throw new Error(`Got ${results.length} qualifying commanders, expected between ${MIN_PLAUSIBLE_COUNT} and ${MAX_PLAUSIBLE_COUNT}.`);
  }

  results.sort((a, b) => a.r - b.r);
  const json = JSON.stringify(results);
  writeFileSync(outPath, `const COMMANDER_TIER_DATA = ${json};\n`, 'utf8');
  return { count: results.length, highestIdChecked: id - 1 };
}

const [, , outPath] = process.argv;
try {
  const stats = await build(outPath || 'commander-tier-data.js');
  console.log('Build complete:', stats);
} catch (err) {
  console.error('Build failed:', err.message);
  process.exit(1);
}
```

```javascript
// .github/scripts/splice-winrate-db.mjs
// Replaces the COMMANDER_TIER_DATA declaration in index.html. Unlike the
// card database, this is a plain JS array literal ending in ]; -- the
// build script already writes a complete statement, so this just finds
// and replaces that whole statement.
import { readFileSync, writeFileSync } from 'fs';

const [, , indexHtmlPath, newDataPath, outPath] = process.argv;
if (!indexHtmlPath || !newDataPath) {
  console.error('Usage: node splice-winrate-db.mjs <index.html> <new-data-file> [output-path]');
  process.exit(1);
}

const html = readFileSync(indexHtmlPath, 'utf8');
const newStatement = readFileSync(newDataPath, 'utf8').trim();

const PREFIX = 'const COMMANDER_TIER_DATA = [';
const startIdx = html.indexOf(PREFIX);
if (startIdx === -1) throw new Error('Could not find COMMANDER_TIER_DATA declaration.');
const endIdx = html.indexOf('];', startIdx) + 2;
if (endIdx === 1) throw new Error('Could not find the closing ];');

const before = html.slice(0, startIdx);
const after = html.slice(endIdx);
const spliced = before + newStatement + after;

writeFileSync(outPath || indexHtmlPath, spliced, 'utf8');
console.log('Spliced. Old statement length:', endIdx - startIdx, 'New statement length:', newStatement.length);
```

---

## 5. Firebase & Worker Reference

### 5.1 Firestore security rules (Revision 3: Revision 2 rules plus PriceScry trades and Chronicle edit/delete)
These are pasted into the Firebase console (Firestore Database, then Rules). They are **not** deployed from the repo. This version replaces the original rules and adds size limits (Section 3.8). **Status: published October 3, 2026, and normal use works.** Before editing it, compare against what is live in the console, then use the Rules Playground to try a deck save, a pod join, a chronicle log, a delete and an oversized write (the oversized-write refusal has not been explicitly tested). It could not be run against the Firebase emulator when written. Every original `allow write` was split into `create, update` (size-checked) and `delete` (not size-checked, because a delete has no `request.resource`). **Revision 3:** these rules add `users/{uid}/trades` (private ledger, size-limited) and `canManageChronicle()` (who may edit or delete a Chronicle entry: pod members who were players in that battle, the pod's leader and co-leaders, or any member when the entry has no player list). Anthony published this version in October 2026 and the Ledger and Chronicles work with it live.

```javascript
rules_version = '2';
// ============================================================================
// PodMates Firestore rules -- the rules from the Product Bible (section 5.1)
// PLUS server-side size limits.
//
// WHY THIS FILE EXISTS: the size limits in index.html (window.PM_LIMITS) stop
// accidents and stop the page from sending oversized data -- but anyone can
// call Firebase directly and skip the page entirely. Only these rules are
// enforced on Google's side, so they are the real backstop.
//
// HOW THE LIMITS RELATE: each limit here is deliberately a bit LOOSER than the
// matching one in the page, so legitimate (or older, pre-limit) data is never
// blocked by the server; the page is the strict one, this file is the net.
//
//   thing                     page limit   rules limit
//   display / player name         40           80
//   commander name               150          200
//   deck name                    200          300
//   deck key                     300          400
//   decklist text             30,000       40,000 characters
//   pod name                      60          120
//   pod members                   30           40
//   gathering title               80          160
//   lineup name                   60          120
//   chronicle notes              500        1,000
//   chronicle decks / players      6 / 12     12 / 24
//   feedback responses            24           48
//   profile link                 200          300
//   trade card / shop / note     150/60/280   200/100/400  (PriceScry ledger)
//   sales per trade               20           40
//
// NOT enforceable in rules (the page enforces these only): number of decks per
// account (150), linked decks (25), pods per account (10), lineups per pod
// (30), chronicles per pod (1,000) -- rules can't count documents -- and the
// size of decklists tucked inside a Gathering's seats (Firestore's own 1 MiB
// per-document limit still applies there).
//
// CHRONICLES (Oct 2026): a Chronicle entry can be edited (notes) or deleted by
// the players who were in that battle and by the pod's leaders; entries with
// no player list (from before Gatherings) can be managed by any pod member.
//
// IMPORTANT NOTES FOR WHOEVER PUBLISHES THIS
//  * Compare against the rules currently live in the Firebase console before
//    replacing them; if they have drifted from the Bible, merge by hand.
//  * Every "allow write" from the original is split into "create, update"
//    (size-checked) and "delete" (not size-checked): a delete has no
//    request.resource, so a size check on it would block all deletes.
//  * This file could not be run against the Firebase emulator when it was
//    written. Publish it, then use the Rules Playground in the console to try:
//    save a deck, join a pod, log a chronicle, delete a deck, and an
//    oversized write -- before relying on it.
// ============================================================================
service cloud.firestore {
  match /databases/{database}/documents {

    // ---- size helpers -----------------------------------------------------
    // A missing or null field passes (the field is optional); a present field
    // must be the right type AND within the limit.
    function okStr(data, field, max) {
      return !(field in data) || data[field] == null ||
             (data[field] is string && data[field].size() <= max);
    }
    function okList(data, field, max) {
      return !(field in data) || data[field] == null ||
             (data[field] is list && data[field].size() <= max);
    }

    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create, update: if request.auth != null && request.auth.uid == userId
        && okStr(request.resource.data, 'displayName', 80)
        && okStr(request.resource.data, 'archidektProfileUrl', 300)
        && okStr(request.resource.data, 'moxfieldProfileUrl', 300)
        && okList(request.resource.data, 'podIds', 40);
      allow delete: if request.auth != null && request.auth.uid == userId;

      match /decks/{deckId} {
        allow read: if request.auth != null && (
          request.auth.uid == userId ||
          (
            resource.data.secret != true &&
            get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('podIds', []).hasAny(
              get(/databases/$(database)/documents/users/$(userId)).data.get('podIds', [])
            )
          )
        );
        allow create, update: if request.auth != null && request.auth.uid == userId
          && okStr(request.resource.data, 'list', 40000)
          && okStr(request.resource.data, 'deckName', 300)
          && okStr(request.resource.data, 'commander', 200)
          && okStr(request.resource.data, 'player', 80)
          && okStr(request.resource.data, 'key', 400);
        allow delete: if request.auth != null && request.auth.uid == userId;
      }

      // PriceScry trade ledger: private to the user, with size limits like everything else.
      match /trades/{tradeId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow create, update: if request.auth != null && request.auth.uid == userId
          && okStr(request.resource.data, 'card', 200)
          && okStr(request.resource.data, 'shop', 100)
          && okStr(request.resource.data, 'note', 400)
          && okList(request.resource.data, 'sells', 40);
        allow delete: if request.auth != null && request.auth.uid == userId;
      }

      match /linkedDecks/{deckId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow create, update: if request.auth != null && request.auth.uid == userId
          && okStr(request.resource.data, 'decklistText', 40000)
          && okStr(request.resource.data, 'name', 300)
          && okStr(request.resource.data, 'commander', 200)
          && okStr(request.resource.data, 'url', 500);
        allow delete: if request.auth != null && request.auth.uid == userId;
      }
    }

    match /pods/{podId} {
      // Used by the chronicles rules below: is this person in the pod, and
      // either one of the players in this entry's battle or a pod leader?
      function canManageChronicle() {
        let pod = get(/databases/$(database)/documents/pods/$(podId)).data;
        let players = resource.data.get('participants', []);
        return request.auth.uid in pod.memberIds
          && (pod.leaderId == request.auth.uid
              || request.auth.uid in pod.get('coLeaderIds', [])
              || players.size() == 0
              || request.auth.uid in players);
      }

      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.leaderId == request.auth.uid
        && okStr(request.resource.data, 'name', 120)
        && okList(request.resource.data, 'memberIds', 40);
      allow update: if request.auth != null && (
        resource.data.leaderId == request.auth.uid ||
        request.auth.uid in resource.data.coLeaderIds ||
        request.auth.uid in request.resource.data.memberIds ||
        request.auth.uid in resource.data.memberIds
      )
        && okStr(request.resource.data, 'name', 120)
        && okList(request.resource.data, 'memberIds', 40);
      allow delete: if request.auth != null && resource.data.leaderId == request.auth.uid;

      match /members/{memberUid} {
        allow read: if request.auth != null;
        allow create, update: if request.auth != null && (
          request.auth.uid == memberUid ||
          get(/databases/$(database)/documents/pods/$(podId)).data.leaderId == request.auth.uid ||
          request.auth.uid in get(/databases/$(database)/documents/pods/$(podId)).data.coLeaderIds
        )
          && okStr(request.resource.data, 'displayName', 80);
        allow delete: if request.auth != null && (
          request.auth.uid == memberUid ||
          get(/databases/$(database)/documents/pods/$(podId)).data.leaderId == request.auth.uid ||
          request.auth.uid in get(/databases/$(database)/documents/pods/$(podId)).data.coLeaderIds
        );
      }

      match /tableFormations/{formationId} {
        allow read: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/pods/$(podId)).data.memberIds;
        allow create, update: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/pods/$(podId)).data.memberIds
          && okStr(request.resource.data, 'name', 120)
          && okList(request.resource.data, 'seats', 12);
        allow delete: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/pods/$(podId)).data.memberIds;
      }

      match /chronicles/{entryId} {
        allow read: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/pods/$(podId)).data.memberIds;
        allow create: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/pods/$(podId)).data.memberIds
          && okStr(request.resource.data, 'notes', 1000)
          && okStr(request.resource.data, 'gatheringTitle', 160)
          && okList(request.resource.data, 'decks', 12)
          && okList(request.resource.data, 'participants', 24)
          && okList(request.resource.data, 'feedbackResponses', 48);
        // Edit (notes, and the ratings added by players) and delete: the
        // players who were in that battle, and the pod's leaders. Entries from
        // before Gatherings existed have no player list, so any member may
        // manage those.
        allow update: if request.auth != null && canManageChronicle()
          && okStr(request.resource.data, 'notes', 1000)
          && okStr(request.resource.data, 'notesEditedBy', 80)
          && okStr(request.resource.data, 'gatheringTitle', 160)
          && okList(request.resource.data, 'decks', 12)
          && okList(request.resource.data, 'participants', 24)
          && okList(request.resource.data, 'feedbackResponses', 48);
        allow delete: if request.auth != null && canManageChronicle();
      }

      match /gatherings/{gatheringId} {
        allow read: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/pods/$(podId)).data.memberIds;
        allow create, update: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/pods/$(podId)).data.memberIds
          && okStr(request.resource.data, 'title', 160);
        allow delete: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/pods/$(podId)).data.memberIds;
      }
    }
  }
}
```

### 5.2 Key cloud functions (module script, `window.PodmatesCloud`)
Reference, not full source (the full module script is ~975 lines — request it directly from the live `index.html` if full content is needed; extract lines between `<script type="module">` and its closing `</script>` tag, found via `grep -n` for exact current boundaries since they shift):

| Function | Signature | Notes |
|---|---|---|
| `cloudSaveDeck` | `(key, entry, docIdOverride)` | Writes to `users/{uid}/decks/{docIdOverride \|\| safeDocId(key)}`. Stores `key`, `deckName` (`entry.deckName \|\| key`), `commander`, `player`, `list`, `secret`, `savedAt`, `updatedAt`. **Throws if `key` is falsy** (defensive guard added this session). |
| `cloudDeleteDeck` | `(key, docIdOverride)` | Deletes `users/{uid}/decks/{docIdOverride \|\| safeDocId(key)}`. **Always pass `docIdOverride` (the real `docId`) when deleting a linked deck's mirror** — its real document ID is never the same as its display key. |
| `cloudLoadAllDecks` | `()` → `{[key]: entry}` | Reads all of `users/{uid}/decks`, keyed by each document's own `key` field (not its Firestore doc ID) in the returned object. Includes `docId` on each entry for reliable targeting. |
| `addLinkedDeck` | `(deckUrl)` → `{ok, deck, id, renamed}` | Fetches via `fetchDeckByLink`, guards against the source returning no deck name (falls back to `"{commander} (Linked)"` or `"Untitled Linked Deck"`), checks the result against the same name-uniqueness pool as manual saves, auto-disambiguates on collision (does **not** offer an overwrite choice — linking is a deliberate one-time action, unlike a routine re-save). |
| `refreshLinkedDeck` | `(id, deckUrl)` | Re-syncs an existing linked deck in place (same stable ID). Preserves the mirror's existing `secret` flag rather than resetting it. Same name-fallback guard as `addLinkedDeck`. |
| `removeLinkedDeck` | `(id)` | Deletes both the `linkedDecks` entry and its `decks` mirror (via the reconstructed `linked-{platform}-{deckId}` ID) — already correct, this one was never the bug. |
| `fetchDeckByLink` | `(deckUrl)` → `{ok, deck}` or `{ok: false, error}` | Calls out to the external `SYNC_WORKER_URL` Cloudflare Worker (source not in this repo). Returns whatever the worker returns, as-is — **the source platform can return no deck name** for some decks; this is not fixable on PodMates' side beyond the fallback already in place. |

| `watchGathering` | `(podId, gatheringId, onData, onError)` → unsubscribe function | **Revision 2.** Firestore `onSnapshot` on one Gathering document. `onData(gathering, metadata)`; the page skips snapshots with `metadata.hasPendingWrites` (this device's own write). Throws if not signed in. |
| `watchLiveGatherings` | `(podId, onData, onError)` → unsubscribe function | **Revision 2.** Live query on a pod's `status == 'live'` Gatherings; drives the "Join Gathering" invite. |
| `updateProfileLinks` | `(links)` | **Revision 2.** Only real http(s) addresses are stored (`safeHttpUrl`); a bare `archidekt.com/u/name` is saved as `https://...`. Over-long or non-web values throw a plain message. |
| size-limit helpers | module-internal | `requireText` (reject), `clampText` (trim), `deckListProblem`, `countDocs` and `docExistsSafe` (6-second timeout, fail open). Every write goes through them. See Section 3.8. |

**Listener rules of thumb (Revision 2).** A listener is billed per change it delivers, which is far fewer reads than polling. Always keep the unsubscribe function and call it when the screen closes (`stopGatheringPolling`, `stopResultsPolling`, `stopLiveInviteWatch`). Always provide an `onError` that falls back to polling.

### 5.3 `generateUniqueDeckName` (classic script, called cross-scope from the module)
```javascript
function generateUniqueDeckName(baseName, existingNames) {
  if (!existingNames.has(baseName)) return baseName;
  let n = 2;
  while (existingNames.has(`${baseName} (${n})`)) n++;
  return `${baseName} (${n})`;
}
```
Called from the module script as `window.generateUniqueDeckName(...)` — see Section 2.3.

### 5.4 Cloudflare Worker: Commander Spellbook combo lookup (NO LONGER USED BY THE PAGE since Revision 3.4)
Source saved in full from earlier in the session (`worker-find-my-combos.js` in outputs) — current as of this session, not touched during recent work. Handles combo detection by querying Commander Spellbook's API given a deck's card list.

### 5.5 Cloudflare Worker: Moxfield/Archidekt sync — **source not available**
This worker is called via `SYNC_WORKER_URL` from `fetchDeckByLink` but its own source code is not stored anywhere in this repo or in prior session outputs. If it ever needs modification, **the source must be obtained from Anthony directly** — do not assume access to it exists.

---

## 6. Feature Inventory

- **Deck Chart (single deck)**: paste/import a decklist, get the full five-axis + Spark analysis, radar chart, mana curve, synergy profile, win-condition detection, Bracket signals, Commander Track Record comparison (empirical win-rate vs. expected Spark).
- **Deck Chart (pod comparison)**: compare up to 6 decks side by side, archetype matchup radar, pace/interaction scatter.
- **Deck Crafter**: search-and-add deck builder, reuses the full card database for instant local search, color-identity warnings against the chosen commander, **plus an Archidekt-style smart filter** (search shows only cards inside the commander's colors and colorless, with a checkbox to switch it off; commander search is never filtered). Results are ranked by `searchCardsByName`: exact name first, then names starting with the text, then a later word, then anywhere; within each group "staples" (cards found in 10 or more of the 159 built-in decks, most common first) come before one-word names, then shorter names, auto-saves drafts to localStorage, can open the currently-loaded Deck Chart deck for editing instead of starting empty.
- **Scan Cards from Photo (OCR)**: Tesseract.js with image preprocessing (grayscale, contrast stretch, size-capped to avoid mobile memory crashes). PaddleOCR was tried as a primary engine and **removed** after causing repeated memory crashes on iOS Safari — see Section 8.5. Do not reintroduce without a clear plan for testing on real mobile hardware, which this development environment cannot do.
- **Deck saving/loading**: Save Deck (with unique-name enforcement and Overwrite/Save-as-New on collision), Load a Deck (modal with search, player filter, delete, secret toggle), Full Ledger (sortable comparison table of all a pod's saved decks).
- **Linked decks**: persistent, auto-refreshing mirrors of Archidekt/Moxfield decks, managed from My Profile. Deliberately separate from the one-time "Import Deck" fetch on the main Deck Chart page, though the two are now connected via a "keep this deck synced" checkbox that appears after a one-time import.
- **MyPods**: a Pod is a persistent group of people, not a fixed set of decks — decks are chosen fresh each Gathering. Pod creation/joining via invite code, Steward (leader) role, member management.
- **Gatherings**: live, in-progress game nights — seat assignment (including host-only add/remove of players to empty/occupied seats), per-seat deck selection, "Sample a Gathering" (try the whole flow with random curated decks, no account needed), live pod analysis during the gathering, post-game Chronicles entry.
- **Chronicles**: post-game record — Fun (1–5), Alignment accuracy (1–5), Best moment (free text), stored per-pod, feeds Player and Pod track records over time. **Revision 3: entries can be edited (notes) and deleted** by the players who were in that battle and by the pod's leaders; entries from before Gatherings (no player list) can be managed by any pod member (`canEditChronicle` in the page, `canManageChronicle()` in the rules). Edits record `notesEditedBy`.
- **Display names (Revision 3).** When someone joins a pod or renames themselves, `findNameConflict` checks the pod's members for the same name (compared with `nameKey`: Unicode-normalised, invisible characters removed, spacing and case ignored). It is a courtesy check only and fails open on a slow network. Clashes that already existed keep their stored names and display as "Alex (1)", "Alex (2)" with a flag.
- **PriceScry (Revision 3).** A password-gated price-history, signals, Ledger, Radar and prediction-scoreboard tool for Anthony's personal use. Everything about it is in Section 14.
- **Player Profile**: separates what someone *owns* (saved deck library) from what they actually *play* (most-played commander, computed from Chronicles battle history, not the deck library) — a deliberate, meaningful distinction.
- **Pod Profile**: pod-wide color/type/Timmy-Johnny-Spike aggregation, Bracket spread histogram, pace/interaction scatter (click a dot to load that podmate's deck into Chart Deck).
- **Commander Track Record**: the one part of the scoring system that isn't a heuristic — real, empirical win-rate data from Playgroup.gg, compared against the deck's theoretical Spark score as a cross-check (flags surprising mismatches in both directions depending on tier).

- **Spark and its explainer (Revision 2).** The radar is the headline. Spark is a small bordered readout beneath it ("Table-alignment signal, Nth percentile of the PodMates reference set"); tapping it opens an explainer that explains the *purpose* (lining a table up before a game; the Pod view uses the gaps between decks' Sparks to label a table Well Balanced / Moderate Spread / High Variance), shows this deck's score x weight x points table, shows what a plain average would read, and states plainly that the uneven weights are a design judgment. Weights (`SPARK_WEIGHTS`): Power 1.5, Disruption 1.25, Speed/Consistency/Versatility 0.75 each; they sum to 5 so Spark stays on the 1-10 scale. Spark is still shown large in the pod ranking, saved-deck table and Try-a-Deck (deliberately left).
- **Commander Centrality (Revision 2).** A panel (open by default) answering "how built-around its commander is this deck?". Shows a band, a 4-step strip, 2-4 plain-English reasons, a 10x10 tile grid (one tile per card; tap a tile to see the card), and support bars against a typical deck of the same archetype. `computeCommanderCentrality` is a pure function in the engine script.
  - *Five signals, 0-100, weighted:* plan involvement 0.25 (share of detected combos that include the commander; drops out when no combos are detected, and the rest are re-weighted), synergy reliance 0.25 (ablation: how much of the synergy web collapses without the commander), deck alignment 0.20 (how much more than a typical deck it leans into what the commander's ability mentions: card types, creature types, counters, tokens, graveyard and so on), ability type 0.10 (a repeating effect counts more than a one-time enters-the-battlefield effect; commander text is read by `analyzeCommanderAbility`), builder investment 0.20 (excess support cards over the archetype baseline: protection, recursion, tutors, cost reducers, equipment/Auras, and cards that name the commander; each kind is capped at 5 over baseline). Generic protection is only counted above what a typical deck of that archetype runs.
  - *Bands:* Self-sufficient (below 25), Supported (25-42), Reliant (43-51), All-in (52 and up). Calibrated against all 159 benchmark decks (roughly 25% / 40% / 24% / 11%), so bands are relative to that corpus, not absolute.
  - *Tiles:* level 4 the commander, 3 essential (in a combo with it, names it, or has no other synergy partner), 2 linked (synergy partner or matches what it cares about), 1 support, 0 independent.
  - *Eminence commanders* count protection and recursion at 30%, since they work from the command zone. `COMMANDER_RULES` holds the commander rules the scoring relies on (command zone, tax, zone returns, 21 damage, identity, partner pairs). **The zone-return rules (section 903.9) have been revised before: graveyard and exile are a state-based action, hand and library a replacement effect, according to the sources found. Verify against the current Comprehensive Rules at magic.wizards.com/rules.**
  - *Known calibration limits:* combos are detected in few decks, and almost every commander reads as a "repeating effect", so those two signals separate decks poorly. The panel (before Revision 3.4: was not recomputed after the old Spellbook recalibration; the Recalibrate step no longer exists, and since Revision 3.4 the panel sees snapshot combos, so its "plan involvement" signal fires more often and has not been re-calibrated).
- **Structure & Legality with copy-limit cards (Revision 2).** A few cards lift the one-copy limit in their own text. The limit is read from the oracle line "A deck can have any number of / up to N cards named X" (`getCopyLimit`), with a fallback table `COPY_LIMIT_FALLBACK` for the 13 known cards as of Oct 2026 (Cid Timeless Artificer, Dragon's Approach, Hare Apparent, Nazgul up to 9, Persistent Petitioners, Rat Colony, Relentless Rats, Shadowborn Apostle, Seven Dwarves up to 7, Slime Against Humanity, Sphinx's Approach, Tempest Hawk, Templar Knight). Ordinary duplicates are still flagged; over-limit copies read "(N copies, limit M)". The Deck Crafter does not enforce or warn about copies.
- **Live Gatherings (Revision 2).** Invites, charted battles, the rating survey and seat changes reach attendees in about a second. The pod landing page keeps one `watchLiveGatherings` listener per pod (stopped when the page is left); the open tray and the results page each use one `watchGathering` listener; each falls back to the old 8-second poll if a listener fails. The tray redraws only when something actually changed, and never over the End Gathering confirmation.
- **End Gathering warning (Revision 2).** In the live tray, if any seat has a deck (a battle is set up but not logged), the confirmation says ending will stop the battle from being logged or rated, offers **Go back** as the prominent choice and **End anyway** as the red one. With nothing seated it keeps the plain wording. The button after a battle is logged keeps its original confirmation. Open question: whether the pod can still rate a battle after the host ends the Gathering once it is logged.
- **Load a Deck (Revision 2).** Your own decks show immediately; podmates' decks load with an 8-second limit, then a Retry notice appears instead of an endless "Loading...".
- **Small UI changes (Revision 2).** The Clear button is an eraser with the tooltip "Clear form" (the bin icon now appears only on real delete buttons).

---

## 7. Known Issues, Technical Debt, and Deferred Work

Status as of October 11, 2026 (Revision 3; items below not mentioned in the Revision 3 lines are unchanged from Revision 2).

**Closed in Revision 3**
- **Chronicles edit and delete**: built and covered by the rules (Section 6).
- **PriceScry**: built (Section 14); its open items are listed in Section 14.6 and 14.5.

**Closed in Revision 2**
- **`escapeHtml` audit**: done as a parser-based sweep of every place that builds HTML, sets a link or image address, or reads a URL input (Section 8.9). This is a sweep of the risky patterns, **not** a line-by-line proof of the whole file.
- **Size caps**: done in the page and the Firestore rules (Section 3.8).
- **The reported "duplicate-commander singleton warning"**: confirmed to be the AI reviewer's mistake, not an app bug. (A *different* two-faced-commander warning bug was found and fixed, Section 8.7.)
- **Commander dependency**: built as Commander Centrality (Section 6).

**Open, security and robustness**
1. **No rate limiting** on direct Firestore access from the browser: one bad actor could burn the daily quota for every user. Size caps limit how much one write can hold but not how many writes happen.
2. **Display-name uniqueness is a courtesy check only** (Revision 3): it is enforced per pod when joining or renaming, fails open, and cannot stop someone calling Firestore directly. Names are not unique across the whole app.
3. **The Moxfield/Archidekt sync worker's source is unavailable** (Section 5.5). Anthony would need to copy it from the Cloudflare dashboard into the repo.
4. **No Content-Security-Policy**: deliberately not added, because the inline scripts, Firebase, Tesseract and CDNs make a useful policy easy to get wrong and it cannot be tested against live services from the development sandbox.
5. **Count limits are page-enforced only** (Firestore rules cannot count documents), and decklists inside a Gathering's seats are size-checked by the page and bounded only by Firestore's 1 MiB-per-document limit on the server.
6. **Existing saved profile links** are not rewritten; they are simply never rendered as unsafe links.

**Open, scoring and data**
7. **Centrality calibration**: plan involvement rarely fires (few decks have detected combos), ability type separates decks poorly (nearly all read as a repeating effect), and some commanders the synergy engine does not model read as zero reliance (Urza, Chief Artificer reads lower than a human would expect). Bands are relative to the benchmark. The panel (before Revision 3.4: was not recomputed after the old Spellbook recalibration; the Recalibrate step no longer exists, and since Revision 3.4 the panel sees snapshot combos, so its "plan involvement" signal fires more often and has not been re-calibrated).
8. **Archetype fingerprints** (`PRECON_FINGERPRINTS`) have drifted slightly (Section 3.6). The staples baseline may have drifted too and has not been checked.
9. **Mana detection long tail**: about 14 odd cards are still missed.
10. **A third field-mix-up has now occurred** (Sections 8.1, 8.2, 8.6). A systematic sweep for code that reads card fields assuming an old schema has not been done.
11. **Staples boost data** is precon-heavy (it only knows the 159 built-in decks). A better source needs a data pipeline.
12. **Older saved decks whose commander name does not match a card** are not re-matched until re-charted.
13. **Verify the commander zone-return rules** (section 903.9) against the current Comprehensive Rules; the wording was confirmed only from secondary sources.

**Open, product**
14. **Spark** is still large in the pod ranking, saved-deck table and Try-a-Deck.
15. **Deck Crafter** holds only one commander (no Partner/Background pairs, so the color filter uses one card), and does not warn about duplicates.
16. **Unverified behavior**: can a pod still rate a battle after the host ends the Gathering once it is logged? A **Load a Deck freeze** was reported once and could not be reproduced; timeouts were added (Section 8.10). If it returns, ask for the first red error in the browser console.
17. **The test harness is not stored in the repo** (Section 13). Committing a `tests/` folder would stop it being rebuilt from scratch each session.

**Strategic items still open** are in Section 11 (cold-start problem, Chronicles as a data asset; deferred: Monte Carlo, corpus expansion, game-shape curve).

---

## 8. Bug History & Lessons Learned This Session

Documenting not just *what* broke, but the *pattern*, since several of these are the kind of mistake that's easy to repeat in a differently-shaped way.

### 8.1 The `.c` vs `.m` field-confusion bug (22 locations)
`classifyCard` and 21 other call sites read `card.c` (mana cost *string*) expecting a number, feeding it into `castabilityWeight()` and `cmcSum` arithmetic. JavaScript coerced the string to `NaN` silently. Visible symptom: Speed score showing literally "NaN", a broken radar chart, "NaN" in explainer text. **Why it wasn't always visible**: most of the affected "weighted" scores had a `|| agg.unweightedVersion` fallback pattern, and `NaN` is falsy in JavaScript — so most computations silently fell back to an unweighted count instead of crashing. Only the one computation without that fallback (`curvePen`, reading `agg.avgCmc` directly) surfaced visibly. **Root cause theory**: the original hand-built card database likely had these two fields arranged differently by coincidence, and this bug was accidentally "working" against that mismatch the whole time — the automated rebuild (Section 4.1), being correct against the documented schema, is what exposed a bug that was probably always latent in the code.

**Lesson**: a bug that's "masked" by a fallback pattern across most call sites but not all of them will look like a narrow, single-location bug until you check every occurrence of the same pattern. Search for the exact broken expression (`card\.c \|\| 0`, in this case), not just the one visible symptom.

### 8.2 The inverse bug: `.m` used where `.c` was needed
`computeManaBaseBenchmark` called `.split()` on `card.m` (a number) instead of `card.ci` (color identity string) when checking which colors a land could "fix." Crashed with `TypeError: (card.m || "").split is not a function` — but only for lands with a *nonzero* mana value (rare, but real — certain creature-lands, MDFC back faces), since `0` is falsy and happened to fall through to the empty-string fallback harmlessly. This is why it looked like "many but not all decks" rather than all of them.

**Lesson**: the same root confusion (string field vs. number field) can show up as the *opposite* mistake elsewhere in the same codebase. After fixing one direction, it's worth deliberately checking for the other direction too, not just declaring victory.

### 8.3 Deck deletion using the wrong identifier
"Load a Deck"'s delete button treated a deck's *display name* as if it were the Firestore document ID. Correct for an ordinary manual save (where they're the same), silently wrong for any linked deck's mirror (whose real ID is deliberately different, so it survives being renamed on the source platform). The delete call succeeded (Firestore doesn't error on deleting a non-existent ID) but touched nothing — meaning this had never actually worked for linked decks, not just for the one visibly broken "undefined"-named deck that surfaced it. Fixed by threading the real `docId` through to the delete action wherever it's available.

**Lesson**: "the delete didn't throw" is not evidence it worked. Silent no-ops on a wrong ID are a real failure mode with Firestore specifically.

### 8.4 The card-database gzip incident (the one real production incident)
First run of the automated card-database rebuild downloaded Scryfall's bulk file without realizing it was gzip-compressed, fed the raw compressed bytes to a plain-text JSONL parser, every line failed silently, and the build produced `cardCount: 0` — which got spliced into `index.html` and pushed to the live site, briefly leaving the production app with zero cards in its database. Recovered via an emergency one-off restore workflow (since deleted) that restored `index.html` from the last known-good commit. Root-caused and fixed by detecting gzip magic bytes and decompressing automatically; the card-count safety threshold (Section 4.1) was added specifically because of this incident, so a similarly-broken future run fails the GitHub Action loudly instead of silently reaching production.

**Lesson**: any pipeline that writes to the live site needs a sanity check on its own output *before* committing, not just error handling on the steps that can obviously throw.

### 8.5 PaddleOCR removal
OCR was upgraded from Tesseract-only to PaddleOCR-primary-with-Tesseract-fallback, aiming for better accuracy on real phone photos. Caused a reproducible crash on iOS Safari (brief white flash, then black screen, then the page reloading — the textbook signature of iOS killing a tab for excessive memory use), most likely from PaddleOCR's own heavy WASM/OpenCV footprint rather than anything in this app's own code. After two rounds of targeted fixes (image size capping, a load timeout) failed to resolve it, the decision was made to **drop PaddleOCR entirely** and return to Tesseract-only, keeping the image preprocessing (which doesn't touch PaddleOCR/OpenCV at all) as the one durable improvement from the attempt.

**Lesson**: a third-party library's own resource footprint on mobile is something that cannot be verified from a development sandbox — it can only be tested on real hardware. When two rounds of plausible fixes don't resolve a reproducible crash, reverting the risky dependency entirely is a legitimate, non-failure outcome — a reliably-working simpler system beats an unreliable better one.

### 8.6 The Mana Base panel: a third field mix-up, and a missing schema contract (Revision 2)
The Cost vs. Production panel read two ideas out of the card database that the automated rebuild never wrote: "what mana does this card make" (code read `card.m`, which is the mana *value*, a number) and "is this a one-shot ritual" (code read `card.r`, which is *rarity*, a word that is always truthy). Every card was therefore filed as a ritual, nothing counted as production, the bars were empty, and the "not counted" list held the whole deck. The old, lost build script had evidently stored those two ideas in those two slots; the reverse-engineered rebuild put mana value and rarity there instead. This is the same family as Sections 8.1 and 8.2.

**Fix and lesson.** The rebuild now stores the two missing fields explicitly (Section 3.5) and the data-script header comment documents all ten tuple slots. **A data builder and the code that reads its output are a contract, and a reverse-engineered builder cannot be trusted to honour a contract nobody wrote down.** Document the schema where the data is stored, and give the builder a sanity check on each field it produces (the 800-producer minimum is exactly that).

### 8.7 Two-faced commanders split in two (Revision 2)
The Commander box split on every slash, so `Front // Back` became two commanders: a false hard "pairing likely isn't legal" warning, and, because loosely typed names (front face only, lowercase) never matched a card, the color-identity check and the Centrality panel silently skipped the commander. **Lesson:** a name has several legitimate forms; resolve names to canonical cards in one function (Section 3.7) instead of comparing strings in many places. The same root cause explained both symptoms, so look for a shared cause before fixing a symptom.

### 8.8 Precomputed tables go stale silently (Revision 2)
The benchmark percentiles were computed once and then drifted as the engine and card data moved (Section 3.6). Nothing errors; percentiles just become slightly wrong. **Lesson:** any constant produced by running the engine offline needs a re-check whenever the engine or card data changes. The check is cheap (recompute and compare), and the result is a number, so it can be asserted.

### 8.9 Security sweep findings (Revision 2)
Method: a JavaScript parser (acorn) listed every template string or concatenation that builds HTML and every interpolation not wrapped in `escapeHtml` or a reviewed helper; every sink (`innerHTML`, link/image address assignments, `setAttribute` of links) was listed and read; URL inputs were traced. Almost everything was already escaped. Two real problems were found:
- **A podmate's display name was inserted into the Load a Deck title unescaped.** A name like `<img onerror=...>` could have run code in the host's browser. Now escaped.
- **Profile and deck links could be `javascript:` addresses.** `escapeHtml` stops text breaking out of an attribute but does **not** stop a link from running code. All user-supplied links now pass through `safeHttpUrl` (http/https only; control characters stripped; bare `domain/path` gets `https://`), and the save step validates too. A before/after test in a simulated browser showed the old code rendering the `javascript:` link and an injected `onmouseover` attribute, and the new code rendering neither.

**Lessons:** escaping text and validating URLs are different jobs. A parser-based audit is far faster and more complete than reading 27,000 lines, and it must be paired with a human read of each flagged helper.

### 8.10 Load a Deck froze on "Loading..." (reported once, not reproduced) (Revision 2)
After a round of changes, Load a Deck once stayed on "Loading..." until the page was refreshed several times. It could not be reproduced, so no single cause is claimed. The likely mechanism is a network step awaited with no time limit. Changes: your own decks render immediately, podmates' decks load with an 8-second limit and a Retry notice, and the new size-cap checks (an extra read and an aggregate count per save) now time out after 6 seconds and let the save proceed (**fail open**). **Lesson:** never put an un-timed network `await` on the path that decides whether a screen ever renders; and a check added for convenience (a count cap) must never be able to block the thing it guards if the network is slow, since the hard limit lives in the rules.

### 8.11 Design lessons from the Revision 2 builds
- **Same logic in two places:** fence the block with BEGIN/END comments, say in both copies that the other exists, and diff the fenced text in a test (Section 3.5).
- **Compare a candidate scoring signal against the whole corpus before trusting it.** Centrality's first version scored 29 of 30 test commanders as "a repeating effect", and the first alignment signal rewarded decks for merely containing some artifacts; each was corrected only after seeing the distribution over real decks (Section 6, calibration limits).
- **Generic support is not commander support.** Judge "invested in the commander" only by the excess over a typical deck of the same archetype.

---

## 9. External Dependencies & Their Constraints

| Service | Used for | Constraints to remember |
|---|---|---|
| Scryfall | Card art (live), full card database (weekly bulk rebuild) | Bulk data is JSONL, gzip-compressed, URL changes every time (look up fresh via `/bulk-data/oracle-cards`). CORS-enabled for direct browser calls (art only). |
| Playgroup.gg | Commander win-rate data | No bulk endpoint, only per-ID lookup. 400 req/min with a descriptive User-Agent (10/min without). They've explicitly sanctioned bulk ID-scanning. |
| Commander Spellbook | Combo detection | Offline snapshot embedded in the page since Revision 3.4 (built by `.github/scripts/spellbook-snapshot.mjs`); the Cloudflare Worker (Section 5.4) is no longer called. |
| Moxfield / Archidekt | Deck import, linked decks | Via a Cloudflare Worker whose source is **not available** in this repo. |
| Firebase (Firestore + Auth) | Accounts, decks, pods, Gatherings, Chronicles | Rules in Section 5.1, including size limits (Revision 2). No rate limiting beyond Firestore's own defaults. Live listeners (`onSnapshot`) are used for Gatherings (Section 6). |
| GitHub Pages | Hosting | Deploys from `main` automatically, 1–2 minute lag, no custom headers support (relevant if ever wanting multithreaded WASM — needs COOP/COEP headers GitHub Pages can't set). |
| GitHub Actions | The two weekly automated rebuilds | Free, unlimited for this public repo. Full internet access (unlike this development sandbox, which is restricted to an allowlist that excludes Scryfall, Playgroup.gg, and GitHub Pages' own domain). |

---

## 10. The Four AI Reviews — Summary

Anthony has been independently gathering AI-generated evaluations of PodMates (from this assistant and others) to compound into a development view. Four reviews were shared this session, all adopting a "Wizards of the Coast R&D" evaluative lens (one more loosely than the others). Summary, with fact-check status where claims were independently verified against the real source:

| # | Character | Verified accuracy | Core verdict |
|---|---|---|---|
| 1 | WotC-voice, surface-level (UI only) | Not fact-checked against source (pre-dated this session's deeper access) | Relevant fan tool, not yet authoritative; flagged corpus bias, opacity, Spark-as-composite, table-reality gap |
| 2 | ChatGPT, explicitly read the source code | **4-for-4 verified exact** — Spark weighting formula, engine-density definition, exact benchmark scores for 4 named commanders, an actual dev comment all matched the real code precisely | Most technically grounded of the four; identified the Spark/radar weighting mismatch with exact numbers, praised the feedback-loop potential (Chronicles → eventual empirical calibration), concluded "Deck Chart is the engine, MyPod is the product" |
| 3 | WotC-voice, second pass (after reading explainers) | Not independently re-verified, but internally consistent and explicitly revises its own first-pass view in good faith | Scoring system "moves from promising fan tool to genuinely useful diagnostic"; independently concluded MyPods/MyProfile is the real product; raised cold-start and adoption-friction risks not mentioned elsewhere; **mentioned an unreproduced singleton-warning bug** (Section 7, item 6) |
| 4 | WotC-voice, generic/consultant-style | **2 checked claims were both false** — "Mana Base Efficiency" and "Interaction Frequency" do not exist as named metrics anywhere in the app | Least reliable on specifics; still independently converged on the same MyPods-is-the-product conclusion; one genuinely useful novel idea (commander-dependency flagging) despite the unreliable grounding |

**The one conclusion all four reached independently, unprompted, in different styles and with different depths of actual investigation**: the Pod/social layer, not the single-deck scoring engine, is PodMates' real differentiator and the correct center of future investment. See Section 11.

---

## 11. Product Manager Review & Roadmap Recommendation

*Written as a synthesis of all four reviews' critiques, weighted by how well-grounded each claim turned out to be, plus my own first-hand knowledge of the codebase from this session's work.*

### 11.1 The headline finding, and why I trust it

Four independently-prompted AI evaluations, of meaningfully different rigor and style, converged on the same structural conclusion without being asked to agree with each other: **PodMates' real product is the playgroup-coordination layer (MyPods, Gatherings, Chronicles, profiles), and the single-deck scoring engine is the acquisition funnel, not the destination.** One review put it as well as it can be put: *"The deck chart is the engine. MyPod is the product."*

I'd weight this conclusion highly. It didn't come from one deep analysis that the others parroted — it came from four separate attempts at the same question, including one (the generic review) that got several technical specifics wrong and *still* landed here independently. When your least-reliable reviewer agrees with your most-reliable one on the thing that matters most, that's the signal worth acting on.

### 11.2 What I'd prioritize, in order, if asked to set the next quarter's focus

**Status as of Revision 2 (October 3, 2026).** Priority 1 (reframe Spark) is **done**, priority 2 (relabel the percentile) is **done**, priority 5 (commander dependency) is **built** as Commander Centrality (Section 6; calibration still open, Section 7 item 7). Priority 3 (Chronicles as a data asset) and priority 4 (the cold-start problem) are **still open**; the cold-start problem needs a design conversation before any code. Section 11.3's deferred items are unchanged. Also done in service of this roadmap: size caps, a security sweep, and faster live Gatherings, since the Pod layer is the product.

**1. Reframe Spark's presentation, not its math.** The sharpest, most concretely verified critique across all reviews is the gap between what the radar chart visually implies (five equal axes) and what the Spark formula actually does (`Power × 1.5`, more than double `Speed`, `Consistency`, or `Versatility`'s weight). This is a wording and visual-hierarchy fix, not a rearchitecture: make the radar the primary artifact, present Spark explicitly as a secondary summary ("one way to read this, not the headline"), and consider naming it something that doesn't imply objective measurement — "Table Impact Index" was one reviewer's suggestion, and I think it's a good one. This is cheap, directly answers the most-repeated criticism, and touches no scoring logic at all.

**2. Relabel the percentile system honestly.** "Scores higher than 80% of our reference corpus" and "80th percentile of Commander" are different claims, and the UI currently doesn't distinguish them. Given the corpus is precon-and-curated-skeleton-heavy (confirmed, not disputed by any review), a quick rename — something like "PodMates benchmark percentile" — costs almost nothing and defuses a real, repeated concern about the corpus's representativeness without requiring the much larger project of actually expanding it.

**3. Invest in Chronicles as a data asset, not just a feature.** This is the single most strategically interesting observation across all four reviews, and it's patient rather than expensive: PodMates already collects exactly the data (Fun, Alignment accuracy, five-axis scores, Spark, outcomes) needed to eventually ask "what weighting actually predicts a good night at the table?" The infrastructure exists. The missing ingredient is volume — real games, logged over time, by real pods. I'd treat growing active Chronicles usage as a quiet but high-priority goal, since it's the one thing that would let a future version of this move from "human-designed heuristic" to "empirically calibrated model," which no competitor deck-analyzer is positioned to do without the same groundwork.

**4. Take the cold-start problem seriously before investing further in the scoring engine.** The second WotC-voice review's point is sharp and specific to this product: if MyPods is the actual value, and that value is invisible behind a signup wall while Deck Chart is freely usable as a guest, then the funnel is inverted — people experience the "engine" for free and never see the "product." I don't have a ready-made fix for this (it's a genuine product design problem, not an engineering one), but I'd treat it as more urgent than any further scoring refinement, since it bears directly on whether the thing everyone agrees is the real value ever gets used by real pods, including Anthony's own.

**5. Consider commander-dependency as a new, genuinely novel axis or flag.** Distinct from existing Commander Alignment (how built-around the commander the deck is), this would answer a different, practically useful question: does this deck's plan survive its commander being removed? That's a real Rule 0 conversation starter ("should we feel bad about targeting your commander with removal") that nothing currently captures. Worth scoping as a real feature, not just noting.

### 11.3 What I'd explicitly deprioritize or decline, for now

- **Monte Carlo hand-simulation for Speed/Consistency.** Genuinely higher-fidelity than the current expected-value model, and more than one review suggested it independently. But it's a real engineering undertaking (an actual simulation engine, not a formula), and I don't think it's the highest-value next step while the cheaper, higher-signal fixes above (1 and 2 especially) haven't been done yet.
- **Expanding the benchmark corpus** (done in Revision 3.3: tuned and cEDH tiers added). Correctly identified as the long-term fix for the percentile-bias concern by multiple reviews, but it's sustained curation work with no shortcut, and the honest-relabeling fix (priority 2) addresses the same underlying trust concern far more cheaply in the meantime.
- **A full turn-by-turn "game shape" curve model.** The most ambitious single idea raised (comparing when each deck's threats/interaction peak across the game, not just a static score) — genuinely interesting, genuinely a "killer feature" candidate, but a substantial new feature in its own right. Worth keeping on a long-term list, not worth starting before the above.

### 11.4 One thing I'd push back on, gently

Anthony has said he sees Spark as "the antidote to brackets," underpinned by five distinct stats rather than one subjective label. I don't think any of this roadmap is in tension with that view, and I want to be clear about why: the critique that's landed hardest (priority 1 above) isn't "five axes collapsing into one number is bad" — it's "the radar visually promises equal weighting that the number doesn't deliver." Making that honest doesn't undermine Spark's value as a concept; if anything, an explicit, defensible weighting story ("Power counts more because raw dominance matters more for table compatibility than raw speed alone") is a *stronger* position than an implicit one a sharp reviewer can catch within an afternoon of reading the source.

---

## 12. Handover Checklist for the Next Session

- [ ] Confirm current script-tag line boundaries fresh (`grep -n "^<script" index.html`). They shift with every edit; treat the numbers in this document as approximate only.
- [ ] Before any `grep`/`view`/`sed` near the card database, `COMMANDER_TIER_DATA` or `PRECON_FINGERPRINTS`, find line numbers first with a command that cannot print the matched line's full content (for example `awk 'length($0)<3000'` into a scratch copy). Dumping those lines costs megabytes of context.
- [ ] **Both GitHub Actions workflows** should show recent successful runs. Both were verified on October 3, 2026: the card-database rebuild after the Revision 2 script change (green, 2,093 producers) and the win-rate rebuild (green, 1,273 commanders, matching the previous count). Re-check them at the start of each session; if either goes silent or red, that is the highest-priority issue, given Section 8.4.
- [x] **`firestore.rules` (Section 5.1) was published on October 3, 2026**, and normal use works with it live (saves, pod joins, deletes). Still untested: that an oversized write is actually refused (Rules Playground), and it was never run against the emulator. Re-test the oversized-write case whenever the rules are edited.
- [ ] The Moxfield/Archidekt sync worker's source is not available anywhere in this project's history. Do not assume it can be read or edited without asking Anthony first.
- [ ] Anthony prefers plain-language explanations with no assumed web-development background. Match that register from the first message.
- [ ] **Deliver complete files, not patches.** Anthony uploads them to GitHub himself and adds his own Firebase/Cloudflare wiring (Revision 2 summary lists where each file goes).
- [ ] **Work credit-efficiently.** Anthony dislikes running out of credits. Prefer small, representative test sets (for example two typical decks per archetype instead of all 159), short replies, and one build pass over repeated round trips. Judge the efficient approach yourself.
- [ ] Anthony's own next step is live bug hunting, then training how cards are assigned to categories. Expect a list of misclassified cards; the classifier is `classifyCard`, and the mana-production logic is separate (Section 3.5).
- [ ] The numbers in this document (limits, weights, baselines, band cut points) are accurate as of Revision 2. The code is the source of truth: check `PM_LIMITS`, `SPARK_WEIGHTS`, `CENTRALITY_WEIGHTS` and `CENTRALITY_BANDS` directly before quoting a value.
- [ ] **PriceScry:** read Section 14 (especially 14.1 standing decisions and 14.10 checklist) before touching anything under `.github/` or the PriceScry code in `index.html`. Never delete the `pricescry-data` branch.
- [ ] Open items worth raising: Section 7 (full list), especially rate limiting, the cold-start conversation, centrality calibration, and committing the test harness to the repo.
- [ ] Always verify claims about "what the code currently does" against the live file rather than this document once any further changes have been made.

---

## 13. Testing Without a Browser (methods that worked, Revision 2)

The development sandbox has no browser and cannot reach Scryfall, Playgroup.gg or the live site. These methods got real test coverage anyway. **The harness files lived only in the session sandbox and are not stored anywhere; recreate them as needed, or better, commit a `tests/` folder.**

- **Run the real engine headlessly.** Decode the embedded card database (gzip then base64), build `CARD_DB`, then load the engine and lookup scripts into Node with `eval` (change top-level `const`/`let` to `var` first so names are visible). With the app's own `parseDecklist`/`matchDecklist`/`buildLookupIndexes` extracted by function name, any benchmark deck can be scored exactly as the page would. This is how benchmark drift (Section 3.6) and the mana panel were verified.
- **Extract functions by name with a parser** (acorn) rather than by line number, then evaluate them inside a simulated browser (jsdom) to test rendering, escaping and event wiring. Before-and-after runs prove a bug was real and is fixed (the `javascript:` link test).
- **A fake Firestore** (an in-memory map with `setDoc`, `getDoc`, `getDocs`, `getCountFromServer`, `onSnapshot`, `arrayUnion`) lets the real module script run so size limits and listeners can be exercised: boot the module with a stub `window`, fire the auth callback, then call `window.PodmatesCloud`.
- **A synthetic Scryfall file** built from the existing database exercises `build-card-db.mjs` end to end (plain, gzipped, and a deliberately broken input that must fail without writing output), plus the splice script. Check the new output equals the old on every pre-existing field.
- **Choosing a small, meaningful deck set:** for each archetype, take the two decks nearest the archetype's average fingerprint (cosine similarity) as the "most obvious" examples. Thirty decks revealed the calibration problems that 159-deck runs then confirmed.
- **Parity checks** where two code paths must agree (database fields versus text fallback across all 159 decks; the two copies of the shared mana block; stored versus recomputed benchmarks) are cheap and catch drift early.
- **Regression checklist after any engine change:** benchmark Spark identical 159 of 159; the 13 copy-limit cards read correctly; DB-field and text-fallback mana results identical; the size-limit suite; the Centrality render on a real deck.
- **What cannot be tested here:** real-device behavior (iOS Safari memory, layout on a phone), real Firebase rules (no emulator), real network timing, and Scryfall's live bulk file. Say so plainly when delivering, and ask for a live check.

---

## 14. PriceScry (added in Revision 3, October 2026)

PriceScry is a password-gated tab inside PodMates for **Anthony's personal use**: MTG card price history, price signals, movers, a trade Ledger, a spoiler radar, and a "shadow prediction" scoreboard that is slowly working out whether new cards move the prices of existing ones. It is opened from **View PriceScry** in the My Profile modal. The password is `moneybags`; it is a **soft door only** (a hash sits in the public page code), not real security, and nothing in PriceScry is secret. It is information, not financial advice, and the page footer says so.

### 14.1 Standing decisions (Anthony's rules; do not relitigate without asking)
- **Buying in Japan only; flipping on Mercari.** Anthony accepts the risk. Sellers of interest: Hareruya, Card Rush / BigMagic, Mercari / Yahoo Auctions.
- **Horizon = days** (flips around spoiler reveals). **The riser screen must never show a card unlikely to at least double.** Gate = **one in three (33%)** chance. **Cost bar = Mercari's tracked rate**: 10% fee + 230 yen shipping + 30 yen packing (`japanCostModel`, `PS_COSTS`; keep the two in step).
- Automatic reading of leaked images is allowed (API credits fine). Spoiler radar should come from non-official sources too.
- **No scraping, no spoofing, no evading blocks.** If a site refuses, say so and stop. Honest User-Agent: `PodMatesPriceScry/1.0 (+https://github.com/anf1978/PodMates)`.
- Claude delivers **complete files**; Anthony uploads them to GitHub himself.

### 14.2 Repo layout, workflows, secrets
- `index.html` at the repo root. `firestore.rules` is pasted into the Firebase console (Section 5.1).
- `.github/workflows/`: `pricescry-daily.yml` (workflow name **PriceScry Daily Snapshot**, runs 06:30 UTC and on demand; keep exactly one file by this name), `pricescry-backfill.yml` (run-once MTGJSON 90-day backfill; safe to re-run), and optionally `pricescry-probe.yml` / `pricescry-tcgcsv-probe.yml` (diagnostics only, can be removed).
- `.github/scripts/` holds the `pricescry-*.mjs` scripts: `lib` (shared helpers: day index, name key, shard hash, series maths, consensus price, cost model), `snapshot`, `fx`, `mtgjson`, `tcgplayer`, `movers`, `links`, `shadow`, `radar`, `study`, `risers`, `sim`, plus selftests (`study`, `risers`, `tcgplayer`, `shadow`) and `build-card-db.mjs` (the card-database rebuild). Test files are environment-specific and optional.
- **Data lives on the `pricescry-data` branch**, rebuilt as **one commit and force-pushed every day on purpose** (the history is inside the files; git history of daily-changing files would only bloat the repo). **Never delete that branch.** The page reads it through `raw.githubusercontent.com/anf1978/PodMates/pricescry-data/`.
- Optional repository secrets (Settings, Secrets and variables, Actions): `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `ANTHROPIC_API_KEY`. **None are set as of October 11, 2026**; the radar says so in plain words. Reddit's Responsible Builder Policy requires **approval before any API access**, so the Reddit part may never switch on.
- Known cosmetic warning: GitHub says Node 20 actions are deprecated; bump `actions/checkout` and `actions/setup-node` versions when convenient.

### 14.3 The data store (`pricescry-data` branch)
- `index.json` (day, firstDay, card count), `movers.json`, `fx.json`, `signals.json.gz`, `uuidmap.json.gz`, `cards/000..511.json.gz` (512 shards, FNV-1a of the lower-cased name key), `tcg-state.json`, `tcg-groups.json`, `catalysts.json` (upcoming sets from TCGplayer), `shadow.json.gz` (the prediction log; append-only), `shadow-report.json` (the scoreboard), `radar.json`, `radar-state.json`, `radar-events.json`.
- **Series format:** change-points `[[day, value], ...]`, day = days since 2020-01-01 UTC, value = integer cents. One record per card name, a list of printings, each with price series under short keys: Scryfall `u, uf, ue` (USD normal/foil/etched), `e, ef` (EUR), `t` (tix); MTGJSON `x` + provider (`t` TCGplayer, `c` Cardmarket, `k` Card Kingdom, `m` Manapool) + kind (`r` retail, `b` buylist) + finish (`n`, `f`, `e`), e.g. `xtrn`; **TCGplayer direct** `qn` (market, normal), `ql` (low, normal), `qf` (market, foil), `qe` (market, etched). The `q*` keys are deliberately separate from `x*` so the consensus never counts TCGplayer twice.
- **Consensus price** = median across shops of the cheapest non-foil printing (`marketCentsAt`); it falls back to Scryfall-only when there is no MTGJSON data.
- **Signals** (`signals.json.gz`): `new_card` (a card not there yesterday: spoiler or release), reprints, bans/unbans, Game Changers list changes, EDHREC rank jumps. Kept 400 days.

### 14.4 The daily pipeline (order of steps in the workflow)
checkout; load history from the data branch; set up Node; download Scryfall `default_cards` (**Scryfall now lists bulk files with `jsonl_download_uri`, gzipped JSON lines; the old `download_uri` is gone**, saved as `default-cards.jsonl.gz`); snapshot; yen rates; refresh the MTGJSON card-id map (first run and Mondays); today's MTGJSON prices; today's TCGplayer prices (`continue-on-error`); movers; **spoiler radar** (`continue-on-error`); **shadow predictions** (`continue-on-error`: `log` then `eval`); publish. The first TCGplayer run is long (about 4 minutes of spaced requests; first full pass priced 148,457 products, updated 97,173 printings); later days are quick.

### 14.5 Sources and their limits
- **Scryfall bulk**: daily prices, new-card detection, previews, card images (`cards.scryfall.io`, shown under the name on the card page).
- **MTGJSON**: about 90 days of retail and buylist history from four shops, backfilled once. It is the only history available; **there is no long-history source**. Known gaps: 3,568 priced MTGJSON cards unmapped; 2,611 uuid collisions keep the first only (a collision-merge improvement is optional).
- **tcgcsv.com** (a TCGplayer mirror, updates about 20:00 UTC): groups, prices, products, `last-updated.txt`. **Its archives were removed** (403 from the operator; no workaround or appeal; do not spoof or retry). Politeness rules in `pricescry-tcgplayer.mjs`: identify the client, space requests, fetch each price file at most once per 24 hours.
- **Not collected yet**: Japanese shop prices (Hareruya, Card Rush, BigMagic) and Mercari / Yahoo Auctions sold prices. Foil cards are valued at the non-foil estimate unless "My price" is entered in the Ledger.
- **Long history was not found** (MTGGoldfish was tricky; tcgcsv archives gone). Decision: **learn forward** with shadow predictions instead of training on history that may not be relevant today.

### 14.6 The engines
- **Link engine** (`pricescry-links.mjs`: `featuresOf`, `buildIndex`, `linksFor(newCardTuple, index, {top, minScore})`, `strongestType`): given a new card, names existing cards it could lift, using mechanic tags, keywords, creature-type "tribal" links (types with 8 or more members, plural forms), named-card links, IDF weighting, and an "enabler" boost for a new legend's colour identity. Link types: `named, tribal, mechanic, enabler`.
- **Event study / riser engine** (`study`, `risers`, `sim`): abnormal returns against comparable cards, placebo tests, Benjamini-Hochberg false-discovery control, cluster bootstrap, walk-forward checks; a ridge logistic riser model with calibration. **Gate:** P(double) >= 0.33 AND at least 8 analogue cases AND Wilson lower bound >= half the shown probability AND net profit >= 300 yen AND at least 30 calibration cases AND the plan verdict is "buy". With only about 158 spoiled cards inside the 90-day window, **the riser screen stays closed until proven**. **Honest status:** no factor yet influences any prediction shown to Anthony; the infrastructure is strong, the evidence is still being gathered.
- **Shadow predictions** (`pricescry-shadow.mjs`): for every new card, writes down the linked candidates (priced at $2 or more, with the price on that day) and scores them 3, 7 and 14 days later against **same-price-band control cards** (bands 200-500, 500-1000, 1000-3000, 3000+ cents). Wilson intervals; hit bar +25%; a verdict needs at least 5 scored events and 30 candidates per link type. Status words: **collecting**, **promising**, **not working yet**, **inconclusive**. A card already in the log (even as a leak) is never logged twice.
- **Spoiler radar** (`pricescry-radar.mjs`): (1) upcoming sets and cards previewed in the last 7 days, from Scryfall's bulk file (no key, works today); (2) Reddit leak/spoiler posts through the **official API with Anthony's key** (needs approval, not set up); (3) reading leaked pictures with Claude (`ANTHROPIC_API_KEY`, default model `claude-haiku-5-5`, at most 8 pictures a day, text treated as data only, never as instructions). Found leaks are linked and written to `radar-events.json`, which the shadow log picks up. Each part is independent and reports its own status.
- **Not built yet** (in rough order): (the manual paste route for leaks is now built, see Revision 3.6); checking whether TCGplayer's unmapped upcoming-set products give early card names; Risers tab (gate-passing cards only); model-health indicator; catalyst calendar and reprint risk; market index and seasonality; cross-market (Japan vs US/EU) lag; Japanese shop collectors (needs probe logs) and Mercari sold-price measurement; wiring ban, rotation and meta event files into the model; link engine into the riser model.

### 14.7 The page (all inside `index.html`)
- **Tabs:** Search, Movers, Signals (with the **Prediction scoreboard** panel at the top), **Radar**, Ledger. Overlay `.ps-overlay` (z-index 1500); pop-up forms `.tad-overlay` (z-index 1000) are raised to 1600 when they follow `#pricescryOverlay`, otherwise the Add Trade form hides behind PriceScry.
- **Back navigation:** opening a card remembers the tab, filters (kept in `psState`) and scroll position; **Back** returns there (`psBackToOrigin`). Search remembers its typed query. Reopening PriceScry starts fresh.
- **Card page:** price history chart by finish and shop, buy planner (`planTrade`, Mercari cost model), "I bought this", "Paper-buy this", artwork under the name (`psArtUrl`).
- **Ledger:** every position is a **lot** (qty, price each, extra cost) with one or more **sales**; paper lots use pretend money. Add/Edit trade (version, reason, shop, note), Sell / edit / remove sale, "My price" check (`markYen` / `markDate`), by-reason table, Export CSV. Open lots are marked at what they would **net** if sold today (consensus price less fees and shipping), not the headline price. Stored in Firestore `users/{uid}/trades/{id}` (Section 3.3), size limits via `window.PM_LIMITS`, `cleanTrade` in the module script.
- **Escaping:** everything read from the data branch or from Reddit/leaks is escaped with `escapeHtml` before display (tested with an injected `<img onerror>`).

### 14.8 Tests (not stored in the repo; rebuilt from the descriptions here)
- Node selftests for the study (17 checks), risers (13), tcgplayer (14), shadow (12), links (7), radar (21, with fake Reddit and Claude servers); a Chromium run (playwright-core, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) for layout stacking, the scoreboard/Radar tabs and Back navigation; a jsdom ledger test (22 checks); YAML validation with Python after every workflow edit.
- **Cannot be tested from the sandbox:** the live Reddit and Anthropic APIs (only fake servers), live tcgcsv/MTGJSON timing, Firebase rules. The first live Reddit/Anthropic run is the real test.

### 14.9 Incidents and lessons
- **Node importer stalled on the 4 GB MTGJSON file**: replaced the stream library with a byte scanner (`streamEntries`; 189 s full import, 1.8 GB).
- **"Downloading undefined"** in the daily run: Scryfall changed to `jsonl_download_uri`; the download step was rewritten and prints the response on failure. A later scheduled run failed the same way only because the **old workflow file was still in the repo**; replacing the file fixed it. Lesson: check the workflow file in the repo actually contains the step you expect.
- **YAML error from a colon-space inside a step name**: always validate workflow YAML before sending.
- **Add Trade "fails"**: the form was hidden behind the PriceScry overlay (z-index), not broken.
- **Probe logs**: when asking for a log, name the exact step; Anthony twice pasted the wrong one.
- **Counting**: say "12 .mjs scripts" only after counting the delivered files.

### 14.10 Operating checklist for the next session
- [ ] Confirm the daily run is green and the TCGplayer, radar and shadow steps ran; check `shadow-report.json` status on the Signals tab.
- [ ] Do not touch the `pricescry-data` branch. Do not set up scraping of any site. Respect tcgcsv's rules.
- [ ] If Anthony adds the Anthropic key, remember the radar reads pictures only from sources it knows (currently Reddit); the manual paste route is the cheap next build.
- [ ] Before claiming any "edge", read the scoreboard: a verdict needs 5 scored events and 30 candidates per link type.

### Revision 3.7 addendum — Key Interactions (Synergy Profile rebuild)
- New display-only module `buildInteractionPackages` / `ixDescribePackage` (before `renderSynergyProfile`). Reads rules text: payoff (trigger or rule-changer), which cards in the 100 set it off, repeaters (flicker, recursion, copies, matching token makers, extra combat/haste) and multipliers (Panharmonicon-style "additional time"). Also cast/draw/lifegain/sacrifice/token/combat-damage triggers and commander attack helpers.
- Ranking: effect weight x supply x repeat x multiplier, commander x1.5, generic "any creature" x0.8; top 5 shown. Self ETB/dies cards grouped as one package.
- Panel: "Key Interactions" (with pilot / opponent / builder line), "Cards With No Clear Link" (review list, not a cut list). Old Strongest Interactions + Engine Cards moved into a collapsed "More card links" section; used as-is if no packages found.
- Scores are untouched (display only). Tested on the Wall deck and 40 precons, no errors.
- Open: Scryfall function tags not yet checked; generic non-commander ETB packages can still be noisy.
- Scryfall function tags (workflow "Scryfall Tags Build", self-contained `scryfall-tags.yml`, run on demand, artifact `scryfall-tags`): 19 tags fetched, token-generator and haste-enabler returned 0 (names wrong). Broad tags (removal 6198, card-advantage 5820, ramp 2153) are too loose to use. Only the small precise `blink` (182) and `extra-combat` (45) lists are embedded as `IX_TAGS` and used as extra repeaters/attack helpers in Key Interactions (e.g. Eerie Interlude now caught as a flicker for the Wall deck). Unused but fetched: trigger-doubler 37, mana-doubler 53, cost-reducer 301, lord/anthem 502, untapper 728.
- Key Interactions pass 2: commander packages always lead; new commander fallbacks (sacrifice outlets need fodder, e.g. Prossh; cost reducers, e.g. Grand Arbiter); wider effect wording (steals, brings cards back, copies, digs, boosts, etc.); multiplier detection now rejects narrow doublers (Wizards, lands). "Cards you could add" popup (button under Key Interactions, bottom sheet): searched on demand from the whole CARD_DB for the top three trigger packages, limited to the commander's colour identity, not banned, not in deck, ordered by MV; lists repeaters, doublers and more feeders (blink tag from `IX_TAGS` helps). Runs in about 0.3 s only when opened. Not yet ranked by popularity (the DB has no popularity field).
- Weekly refresh now also covers function tags: `rebuild-card-database.yml` has a new step (continue-on-error) running `.github/scripts/fetch-function-tags.mjs` (otag blink + extra-combat, front-face lower-case names), then `splice-card-db.mjs` takes an optional 4th argument (the tags JSON) and rewrites the single-line `const IX_TAGS_JSON = {...};` in index.html. Sanity floors (blink >= 50, extra-combat >= 10): if a fetch looks wrong, the old lists are kept and a warning is printed. To add a tag: add it to TAGS in the fetch script, the MINIMUMS in the splice script, and read it in `IX_TAGS` in index.html. The IX_TAGS_JSON line must stay on one line.
- Key Interactions pass 3 (Wall deck feedback: Tetsuko, Slaughter the Strong, Tower Defense, Baldin were wrongly "no link"). Causes: (1) no concept of a stat axis (Arcades makes toughness deal damage, so toughness pumps are finishers, power is irrelevant); (2) stat conditions ("power 1 or less", "total power 4 or less", "power N or greater") were never read against the deck; (3) a card that repeats the commander's rule (Baldin) was not recognised as backup. Fixes: `axis` detection; commander rule blocks list Finishers and Backup; new "Cards That Depend On Your Creatures" section (power/toughness conditions, wording differs for "or less" vs "or greater"); the old list is renamed "Not Understood Yet" with softer wording. Known gap: the card database has no power/toughness fields, so conditions are explained but not counted against the deck. Proposed next: add power/toughness to the weekly database build so each condition can say "N of your creatures qualify".
- Key Interactions pass 4. Card database tuple grows from 10 to 13 fields: `pw`, `tg` (printed power/toughness as text, front face, "" for non-creatures) and `x` (1 = not legal in Commander per Scryfall legalities). `build-card-db.mjs` computes them with sanity floors (>=5000 cards with a power, >=300 not-legal cards). `decompressCardDB` reads them when present (undefined on an older database). Until the first weekly rebuild after this release, power/toughness counts are simply absent and joke cards are screened by a text heuristic (`ixUsable`); after it, `x` decides. Suggestions: skip generic feeders, joke/un/playtest cards; new exact-link suggestions only for (a) a toughness-damage commander (cards that give the whole team the rule; team-wide toughness pumps ranked by size) and (b) a sacrifice commander (cheap creature-token makers). Deliberately NOT suggested (loose coupling): cost-reducer commanders, cast/draw/life triggers, per-creature equipment or aura versions of a rule. Stat conditions now show counts from real stats ("38 of your 41 creatures qualify"), and the commander rule block shows combined toughness damage versus power.
- Health check (Oct 20, 2026): all scripts parse; 0 duplicate element ids; 0 undefined references; 0 inline-handler names missing; no debug leftovers. Removed dead CSS (an older duplicate `.confidence-*` block, unused `.ps-result` rules). Ran all 159 precons: no errors, Key Interactions 35 ms max, popup 270 ms max; full analysis output identical to the pre-Key-Interactions build for all 159 decks. Not testable offline: live Firebase sign-in/sync, Scryfall and GitHub workflows.
- Key Interactions pass 5 (Zacama hard-ramp / wrath deck feedback). The panel only knew trigger and rule packages, so a plan built from deck make-up (ramp into an expensive commander, mana-sink commander, board wipes) read as noise. New "plan" blocks, shown first: (1) Ramp into the commander (commander MV 6+ and 16+ ramp pieces, or 22+; counts land fetch, rocks, mana creatures, doublers/untappers); (2) Mana-sink commander (2+ mana-only activated abilities, or 1 on an expensive commander; shows each ability, the enter-untap-lands line and doublers); (3) Board wipes (6+ wipes/sweepers; lists cards that give indestructible to keep the commander alive). Thresholds chosen from the 159 precons (ramp p90 = 15, wipes p95 = 5), so only about 5% of precons show them. New display-only `ixRoles` (land-search ramp such as Scapeshift/Skyshroud Claim/Reshape the Earth, X-damage sweepers such as Delete, "each player sacrifices" wipes, threaten, mass haste) stops those cards landing in "Not Understood Yet". Enter-effect group block now needs 4+ members and ignores cards whose effect is unknown. classifyCard and all scores untouched (159 decks identical).
- Key Interactions pass 6 ("What helps <commander> work"): a plan block listing exact, text-based enablers, each only if the commander really has the need: cheaper activated abilities (Zirda; only for commanders with mana-cost abilities), damage doublers (Solphim; only if the commander deals damage), cards that pay off its life gain (only if it gains life), haste (only if the commander lacks it and costs 5+), and protection from removal (hexproof/shroud/indestructible granters; commander cost 5+). Ramp block also lists landfall cards ("every extra land also triggers"). Shown on about 23% of precons (mostly the protection line). Zacama deck now names Zirda, Solphim, Heliod, Lightning Greaves, Swiftfoot Boots, Rising of the Day, Everybody Lives!, Felidar Retreat and Lotus Cobra. Display-only; 159 decks' scores identical.
- Key Interactions pass 7: "What helps" block now also names damage reflectors ("whenever ~ is dealt damage, it deals that much damage to target opponent", e.g. Brash Taunter), shown when the deck has damage sweepers (Blasphemous Act, Earthquake, Delete...) or the commander deals damage; lists those sources. Added at the user's suggestion (Taunter absorbs Zacama's own 3 damage and the deck's sweepers, then hits an opponent).
- Key Interactions pass 8: mana-sink commander plan splits Untappers (Wilderness Reclamation-style: untap all lands/permanents at end step or other players' untap step; a second full set of mana, instant speed) from Doublers. "Cards you could add" gains a "Spare mana" group for such commanders: untappers (Seedborn Muse appears for Zacama) and mana doublers from the whole card list, MV 6 or less, ordered by MV (so some weak doublers rank high; ranking by strength needs popularity data we do not have).
- Key Interactions pass 9 (enchantress/aura monolith deck, Sythis). Bug fixed: the type check for "whenever you cast a ___ spell" triggers was case-sensitive and never matched ("Enchantment"), so typed cast triggers (including the commander's) were silently missing. Fixes: case-insensitive `hasType`; Open the Vaults style "from all graveyards to the battlefield" now counts as a repeater; pooled blocks merge "an enchantment"/"another enchantment" phrasing. New plan blocks: "N Auras" (8+ Auras; groups auras that grow with enchantment count, evasion/staying power, ways to bring Auras back) and "N protection pieces" (7+, creatures counted only when they grant protection to others; about 2% of precons). New display-only roles `aura`, `massReturn` keep Auras and mass-return spells out of "Not Understood Yet". Scores untouched (159 decks identical).
- Text size toggle (Display settings in My Profile, above the colour themes): Normal / Large (115%) / Larger (130%) / Largest (150%), per device (localStorage `pm-text-scale`), applied early by `PMText` in theme-script via the CSS `zoom` property on the page root, so everything scales like browser zoom without changing layout rules. Tested at 390 px wide on all four sizes: no sideways scrolling. Limitation: relies on CSS zoom (Chrome, Safari, Firefox 126+); an older browser simply ignores it.
- Real power/toughness data verified (Oct 21, 2026) on the rebuilt database: 35,582 cards, 19,576 with a power value, 3,393 flagged not Commander-legal, 0 cards missing the new fields. About 440 cards have non-numeric values ("*", "1+*", "+2", "∞", ".5"): `ixStat` now treats anything that is not a whole number as unknown instead of guessing (it previously read "1+*" as 1). Wall deck with real stats: 36 matching creatures hit for 165 combined (toughness) versus 12 by power; Tetsuko qualifies for 36 of 41 creatures; Slaughter the Strong keeps 36 of 41. Not-legal screening is now belt and braces: the flag plus a text/type check always (Scryfall lists Eternal Acrobat Toast, a Stickers card, as legal). The working file now uses the rebuilt database.
- Text size fixes (Oct 21, 2026, from phone testing). (1) Pop-ups could not be scrolled to the top, hiding the Close button: CSS `zoom` also multiplies `vh`, so `max-height:85vh` became taller than the screen and the centred pop-up was cut off at both ends. Fixed by dividing the vh limits by the zoom (`--pm-zoom` variable set by `PMText`): pop-up 85vh, Load Deck list 50vh, "Cards you could add" 78vh. Tested at 100/130/150%: pop-up top and Close stay on screen. (2) The radial chart's text never grew with the text size, and was only about 6-7 px on a phone anyway because the whole SVG is scaled to fit. Now on narrow screens the label, value and percentile sizes are set from the width the chart really gets (readable at 100%), the stack spacing is computed from those sizes (no overlaps), the chart is re-drawn when the text size changes or the phone turns, and a plain-text list of the five scores with percentiles sits under the chart (shown on narrow screens or whenever the text size is above Normal; it scales with the text size). At a larger text size the numbers move out of the SVG into that list.

## Pass 10 (Oct 21, 2026): centrality symbols, flip, scanner move
- Centrality grid: type symbols, land colour pips (W/U/B/R/G letter on single-colour), "Symbol key" popup, touch caption (`#ccCaption`) because `title` tooltips do not work on touch.
- Two-faced cards: `extractFacePair` / `cardOtherFaceCache` / `urlMap.getOther`; flip button (`data-flip-btn`) in single-card popup, View Deck and type galleries, commander hero. Only true two-image DFCs get it.
- Photo scanner moved from the main button row into Deck Crafter ("Scan cards from a photo"). Results go to `deckBuilderCards` with identity/limit checks; closing the scanner returns to Deck Crafter.

## Pass 11 (Oct 21, 2026): Super Friends / planeswalker plan
- Card DB tuple now 16 fields: adds `ly` (starting loyalty), `ob` (back-face rules text), `bt` (back-face type line). Floors in build-card-db.mjs: loyalty >= 300, back faces >= 800. splice script and workflow unchanged.
- `ixWalkerPlans` (before `buildInteractionPackages`): shows when the deck has 8+ planeswalkers (only 1 of 159 precons: Commodore Guff). Reads ultimates (cost <= -5) from the card text, loyalty boosters (`IXW.doubler`, doubleNow, proliferate, feeders, Carth's free counter), extra uses (Chain Veil, Urza Assembles the Titans, Leori, Jaya's Phoenix, Peregrine Dynamo, Bolas Dragon-God, Spark Double), protection, finders/rebuy. "Ultimate the turn it lands" needs loyalty data and a counter doubler (x2); without loyalty it lists ultimates and says timing arrives with the next rebuild.
- Commander block: if the back face reveals until a planeswalker and puts it onto the battlefield (Esika), a commander line shows.
- Loyalty-ability lines and emblem lines are no longer read as triggers (fixes "Teferi removes things whenever you draw"). Planeswalker "dies" triggers no longer list wipes/token makers as repeaters. Proliferate now has its own effect label.
- Suggestions popup: "Super Friends" group (double loyalty, proliferate, use again, keep alive, find/rebuy, more walkers with reachable ultimates). Display-only: 159-deck score regression identical.

## Pass 12 — Combos popup (display only)
- Bracket panel: combo line replaced by up to 3 lines + "How these combos work" button -> `openCombosPopup()` (uses `window.__comboAgg`).
- Popup: "In your deck" cards (Wins gold / Warps teal, piece chips, tap for How it works + each piece's role) and "One card away" (dashed gold chip = missing card, grouped by missing card).
- `comboNearMisses(namesInDeck, commanders, identity)` in the engine: Spellbook rows and curated HARD_COMBOS missing exactly one piece; missing card must pass `ixUsable` and the commander's colours; rows that only extend a complete combo are skipped; max 8 groups, 3 lines each, max 2 groups per lone held card. Stored as `agg.comboNear`; never affects scores.
- Explanations: `COMBO_STEPS` (hand-written, ~26 well-known lines, key = card list, " / " = any of), else `comboHow()` template by outcome label. Roles by `comboRole()` regexes on oracle text.
- Not done: live Commander Spellbook step text (needs API/CORS check, no combo IDs in snapshot); steps for the remaining curated lines.
- Regression: 159 decks, 0 score differences (hash excludes `comboNear`); analysis max ~60 ms.

## Pass 13 — Card knowledge from ranked lists (Tier 1)
- Source: Draftsim role lists scraped by the user (TSV: list_id, source_url, list_length, scraped_date, ranked, rank, group, card_name, kind, tags, needs, reason). Equal ranks = ties (e.g. signets/talismans). Rows can exceed list_length because of ties.
- Tool: `out/tools/know-build.cjs <tsv...>` matches names to CARD_DB (full or front-face), tiers ranks (3 = rank<=5 or top 12%, 2 = top 40%, else 1), writes `know.json` + report. Output is injected as ONE line `const KNOW_JSON = {...}; // KNOW_END` after `IX_TAGS` in index.html (replace the whole line when lists change).
- App use so far: `knowQ` lifts cards scoring >=2 in all suggestion groups (`by`, `by2`); `knowBadge` shows "top-rated: <list>" on tier-3 cards. Scores/classification untouched (159-deck regression 0 diffs).
- Tier 1 result: 16 lists, 865 rows, 708 cards matched; unmatched: Apex Observatory, Lead Myr, Garden of Freyalise, Skyscape Familiar.
- Next: Tiers 2 (archetypes), 3 (enablers), 4 (colour staples, budget, precon guides) arrive as separate TSVs; role-gap lines in synergy boxes; staple badge idea for PriceScry (private).

## Pass 14 — Tiers 2 and 3 merged
- Build command: `node know-build.cjs role:<t1.tsv> theme:<t2.tsv> enabler:<t3.tsv>` (kind prefix per file; entries now `[listIdx,tier,isCommanderRow,rank]`, lists carry kind). 46 lists, 1,794 cards; unmatched: Apex Observatory, Lead Myr, Garden of Freyalise, Skyscape Familiar, Mole Man Moloid Man.
- Commander-pick rows never lift or badge a card. Theme suggestions (`knowThemeSuggestions`): kind=theme lists where the deck holds >=5 and >=10% of the list; max 2; the broad commander-staples list only shows when nothing specific qualifies (user decision). Landfall threshold deliberately NOT lowered (secondary theme in the Hazezon deck).
- Tier 3 gaps: death triggers lacks ranks 5-8 and 13; ETB creatures lacks rank 2; cycle entries list only pictured cards; tags beyond archetype are the scraper's own classification.
- The Mind Stone IS a genuine blink card (harnessed end-step exile and return); an earlier note calling it a false match was wrong.

## Pass 15 — Tier 4 merged (staples, budget, precon guides)
- Build: `node know-build.cjs role:t1 theme:t2 enabler:t3 mixed:t4` (mixed assigns kind by list id: `*-upgrade-guide` = precon, `budget-*`/`best-affordable-cards` = budget, else staple). 100 lists, 2,910 cards. Unmatched: the five earlier plus Revenge of the Ravens.
- Colour lists are ALL-FORMAT (not Commander-specific); budget lists and precon guides count only as consensus (`knowStrong`); only role/theme/enabler lists lift ordering or show the top-rated badge.
- Precon guides: unranked, group add/cut. Adds count as consensus; cuts are stored as card field [7] = number of guides that cut it (604 cards; e.g. basic lands, Commander's Sphere, Solemn Simulacrum). Not yet shown anywhere.
- Source caveats from the scraper: colourless rank 2 (Original Mox Cycle) has no rows; three guides lack cuts (Calling All Angels, Silverquill, World Shaper 18); 41 guides fetched, more exist; some precon titles disagreed with bodies (bodies followed); two-faced cards may be front-name only (Malakir Rebirth, Sejiri Shelter, Revitalizing Repast, Ojer Axonil); cut-side reasons are generic.

## Pass 16 — Thin spots
- `IX_THIN_FLOORS`: removal < 4, ramp < 8, card draw < 8 (just under the 10th percentile of the 159 precons: removal 4, ramp 9, draw 10). `ixThinSpots(roles)` -> line "Thin spots: removal (3 of 4+)" under the "Cards you could add" button; `ixThinSuggestions` adds a "THIN SPOT" item per light role with the top-ranked legal cards from the Tier 1 lists (spot removal; rocks + dorks; card draw). ctx now carries `roles` from agg. Display only, 0 score differences.
- Urza's Saga under Skullclamp is a genuine match (Constructs); the Adagia/Mirrorpool matches no longer surface after top-rated ordering, so no change made.

## Pass 17 — Impact cards: nominations and list-based ideas
- Impact modal gets "Nominations and ideas": (1) member nominations, (2) ideas from the card lists (`IMPACT_CANDS`, built by `impact-cands.cjs`: top-tier on power lists, <= 3 of 159 precons, not Game Changers/defaults; interleaved by source list), (3) members can nominate any card via search with an optional note.
- Leaders (Steward/Co-Stewards): Add / Not for us on ideas; Accept / Not for us on nominations; "Bring back N turned-down cards". Members: Nominate, Withdraw own. Max 25 open nominations (page-enforced).
- Storage: turned-down ideas = `settings/impactCards.dismissed` (map, leaders write; existing rule already allows it). Nominations = NEW collection `pods/{podId}/impactNominations/{cardKey}` {card, note, by, byName, at}. **Needs the updated `firestore.rules` published** (new `match /impactNominations/{cardKey}` block: members read, create/update/withdraw only their own, leaders can delete any). Until then members see "Nominations are not switched on for this pod yet" and permission errors show a plain message.
- Still pod-view only: the radar and every band use the default list. Tested with a stubbed cloud (member nominate -> leader accept/dismiss/restore); NOT tested against real Firebase.

## Pass 18 — Catch-up notes and the card-lists project in one place
**Items built earlier but not yet recorded:** (a) Key Interactions plans for lands (landfall, graveyard, feed, replay, ramp, doubler, animate; `IXL`, `IXL_MIN=6`) and go-wide (anthem, haste, finisher, doubler; `IXG_MIN=16`, `IXG_SHELL_MIN=9`); wide plan fired on 12 of 159 precons. (b) Pod radar mini charts show score labels again (`renderPodMiniCharts`, VW 280 x VH 216). (c) Deck Crafter list hardening (`.db-deck-list` plus re-activation on open); the real-phone bug was never reproduced, so the fallback (make the whole popup scroll) is still available. (d) "Cards you could add" popup redesign: teal "In your deck" band over gold "+" rows.

**Card-lists project (Draftsim scrape, Oct 2026): what exists**
- Four scraped TSVs (columns: list_id, source_url, list_length, scraped_date, ranked, rank, group, card_name, kind, tags, needs, reason): Tier 1 role lists (16), Tier 2 archetype/theme lists (20), Tier 3 mechanic lists (10), Tier 4 colour staples, budget and 51 precon upgrade guides. Equal ranks are ties (signets/talismans). Rows can exceed list length because of ties.
- `out/tools/know-build.cjs role:<t1> theme:<t2> enabler:<t3> mixed:<t4>` (needs the page and `/opt/pw-browsers`) matches names to CARD_DB, tiers ranks (3 = rank<=5 or top 12%, 2 = top 40%, else 1), keeps precon cuts as a count, and writes `know.json`. Result: 100 lists, 2,910 cards. The JSON goes in index.html as ONE line `const KNOW_JSON = {...}; // KNOW_END`. Re-run and replace that line when lists change.
- Only role, theme and enabler lists lift ordering or show the "top-rated" badge (`knowStrong`); colour lists (all-format), budget lists and precon guides add only a small consensus bonus. Commander-pick rows never lift a card.
- Where used: suggestion ordering (`knowQ`), badge (`knowBadge`), theme blocks (`knowThemeSuggestions`: theme lists where the deck holds >=5 and >=10%; max 2; the broad commander-staples list only when nothing specific qualifies; landfall threshold deliberately not lowered), thin-spot lines and blocks (`IX_THIN_FLOORS`: removal <4, ramp <8, draw <8), impact-card idea queue (`IMPACT_CANDS`, built by `out/tools/impact-cands.cjs`).
- Known gaps: Original Mox Cycle (colourless rank 2) has no rows; death triggers lacks ranks 5-8 and 13; ETB creatures lacks rank 2; three precon guides lack cuts; more precon guides exist; two-faced names may be front-only. Unmatched names: Apex Observatory, Lead Myr, Garden of Freyalise, Skyscape Familiar, Mole Man Moloid Man, Revenge of the Ravens.
- Not yet shown anywhere: precon "often cut" counts (card field [7], 604 cards). PriceScry staple badge idea (private, never in pod-facing text) not built.
- Deferred by the user: "plan coherence" shadow test; tiered list weighting inside existing scores (would need a shadow test on the 159 precons first).

**Impact cards: nominations (Pass 17) and the rules.** Published by the user on 22 Oct 2026: `out/firestore.rules` (compact, no comments; the commented master copy is `handover/firestore.rules`). New collection `pods/{podId}/impactNominations/{cardKey}`; `settings/impactCards.dismissed` holds turned-down ideas. Tested only with a stubbed cloud, not yet with real accounts.

**Regression baseline:** all changes since Pass 12 verified at 0 score differences across the 159 precons (hash excludes `comboNear`); analysis max ~60 ms.

## Pass 19 (22 Oct 2026): suggestions audit, New Dimension, sticky Close, notifications, combo write-up audit

**Suggestions correctness audit ("Cards you could add" must never be wrong).** Trigger: Evolution Sage (landfall) was offered blink/reanimation cards that do not make lands enter. Fixes: `ixNouns`/`ixNounOk` check type compatibility between what a trigger watches and what a suggestion produces (a land trigger only accepts land-producing ideas; "nonland permanent" stripped when the filter is land only); `ixBlinkFits`, `ixOneShotReturn`, `ixHurtsOnlyYou`, `ixThinFits` guard blink, one-shot return, self-damage and thin-spot suggestions; `ixRepeaterKind`/`ixMultiplierKind` stop doublers being offered to the wrong triggers; anthem regex anchored before "creatures you control get" (tribal anthems excluded); token-copy detection tests the capture group not the whole match; `shownOnce` dedupes at the end of `buildInteractionSuggestions`. Tested across scenarios with Playwright (au1-au6 scripts, scratchpad only).

**New Dimension band** (`ixNewDimensions`, table `IXD`, rendered by `ixShowSuggestions` as a purple band for items with `dim: true`). Suggests cards or groups that add a new axis to the commander's plan or the deck's theme. Fires on about 91 of 159 precons; thresholds are tunable in `IXD`. The user checked three decks and it appeared in one.

**Sticky Close.** `.tad-close` and the combo popup header are `position:sticky` so long popups never need a scroll back to the top; `pmStickyCloseNet` applies it to any overlay that lacks it.

**Notifications, Layer 1 (bell).** Script `notif-script` plus module hooks. New collection `pods/{podId}/activity/{activityId}` {type in deck|gathering|live|nomination|joined, by (== auth uid), name/text, at}. Rules block published by the user: read for pod members; create by a member with `by == auth.uid`, size limits; update never; delete by the actor, leader or co-leader. Bell shows unread count; settings are per device; it only updates while the app is open (no push yet). "Charted a deck" = created and SAVED a new deck (the user's definition); analysing without saving does not count. UI tested with a stubbed cloud only; NOT tested with two real accounts. Not built: push/email, RSVP events, a seen-state shared across devices.

**Combo write-up audit (this pass's main work).**
- Bug reported: Top + Foundry Inspector + Mystic Forge ("Infinite card draw") told the player to "aim it at an opponent" and that it "can finish the game by itself". Draw only ever draws for you.
- `comboKind(outcome)` now classifies every outcome label (all 120+ Spellbook labels and the 40+ curated ones are covered; see test d5) into about 35 kinds, each with its own text in `comboHow`: mana (with notes for spend limits and mana given to opponents), draw (own cards only), turns (whose turns), combat phases / combat damage, damage and life loss (near-infinite wording; "all players" warns it hits you), damage to creatures, kill a player (later-step losses, lock-outs), win / win next upkeep, opponent mill and exile, mill-all, own library (exile, self-mill, cast all, put creatures), wipes, land denial, discard, planeswalker activations, removal, lock, large creature, life, tokens, ETB loops.
- Wins vs Warps tag is display only: `comboDisplayWin(outcome, flag)`. Kill, win, damage, combat damage and opponent-library lines show Wins; mana, draw, turns, combat phases, own-library, wipes, creature damage, life, tokens, ETB lines show Warps (they need a payoff). Anything else keeps the data flag (`comboClass`/`cls`). Scores are untouched: 159-deck hash check = 0 differences.
- Hand-written `COMBO_STEPS` corrected after a rules check: Rings of Brighthearth copy costs {2} (not {1}); Forsaken Monument adds ONE extra {C} per tap (Monolith taps for 4, nets +1); Power Artifact makes Basalt Monolith net +2 but Grim Monolith only +1; Duskmantle Guildmage needs its {1}{U}{B} ability activated first; Pitiless Plunderer line nets a Treasure (not mana plus a Treasure); Mikaeus + Triskelion rewritten; Helm of Obedience lines say one opponent and "loses when they next draw"; Tainted Pact says decline every card.
- Piece roles removed: the old keyword guess (`comboRole`) was wrong often (Kiki-Jiki "makes tokens", Isochron Scepter "enter trigger", Nim Deathmantle "mills", Forsaken Monument "gains life"). The popup now lists "The cards" with factual type line and mana value only. Do NOT reintroduce keyword role guessing; if roles are wanted, write them by hand per curated combo.
- "Pieces could all be on the table around turn N" now reads "If you drew them all, the pieces could be out by about turn N" (cost-only estimate; ignores tutors and what is already on the battlefield).
- Known limits: Spellbook "Infinite" tag appears on some non-loop wins (e.g. Approach of the Second Sun + Mystical Tutor) because it comes from the snapshot's flag; step text exists only for 25 curated lines, everything else gets the label template; curated multi-effect labels use the first matching kind.

**Open decisions (user):** Game Changers for lower-bracket decks (hide or warn); trim or reword the "Commander staples" block; more notification events (RSVPs); New Dimension thresholds; a live Commander Spellbook step-text layer (API/CORS unchecked; offline version stands).

## Pass 20 (22 Oct 2026): Game Changer warnings, staples removed
- Suggestions: a suggested Game Changer now shows an amber warning (⚠) when adding it would change the deck's bracket: deck is Bracket 1-2 -> "adding it lifts this deck to Bracket 3"; deck is Bracket 3 with 3 or more Game Changers -> "would be your 4th, over the Bracket 3 limit of 3". Otherwise the plain "(Game Changer)" label stays. Not hidden (user's choice: warn). Implemented by `ixGcNote()`; `renderBracket` stores `window.__pmBracketKey` / `__pmGcHeld`.
- The broad "commander staples" best-of list is never shown as a theme block any more (user: most players know these). `knowThemeSuggestions` only returns specific theme lists.
- Notifications: no further events for now (user).

## Pass 21 (22 Oct 2026): Host a Gathering — guest seats, waiting state, invites and replies
**Design (agreed with the user):** guest = a NAMED SEAT, no account; players Accept or Decline; optional date, time and place (all three); invites are in-app only (bell + My Pods card + a copyable message). Email/push needs a backend and is deferred ("a backend can be built at some point").
- **Statuses:** `proposed` (waiting) -> `live` -> `ended`, or `proposed` -> `cancelled`. Old `setup` is no longer used by the UI. New gathering fields: `whenDate` (YYYY-MM-DD), `whenTime` (HH:MM), `place`. Seat fields: `rsvp` ('invited'|'accepted'|'declined'; missing = accepted, so older gatherings still work) and `guest: true` for guests (uid = `guest:<time><seat>`, never a real account).
- **Host screen** (`openHostGatheringOverlay`): name, when/where, seats (podmate or "+ Add a guest (no account)…"), saved lineups (guests are saved by name). Two buttons: **Send invites & wait for replies** (needs at least one podmate) and **Start now** (needs 2+ seated; podmates are seated as accepted). `showInvitesSent` is the confirmation: who was invited, guests need none, an honest note that email/phone alerts do not exist yet, **Copy an invite message**, Open the waiting room. If the bell write fails it says the invites could not be confirmed and points to Resend.
- **Waiting room** (`renderWaitingTray`, drawn in the same tray as live): "n of m confirmed", per-seat badge (Host / Guest / Accepted / Waiting / Can't make it). Host: Start (confirms if people have not replied; declined seats are cleared on start), Resend invites (only people still waiting), Edit details, Copy invite message, Cancel (tells everyone), add podmate or guest into empty seats, Replace / Clear a declined seat. Invitee: Accept / Can't make it (changeable), can pick a deck while waiting.
- **Landing (My Pods)** (`paintOpenGatherings`): green Join for live; "Waiting for replies" card for the host; invite card with Accept / Can't make it / Details; "You're in" card once accepted. Declined, cancelled and stale (a day or two past the date, or a week with no date) gatherings are hidden.
- **Bell:** new types `invite` (to the invitees), `rsvp` (to the host), `cancelled` (to invitees); tapping an entry opens the gathering. **Firestore rules:** the activity `type in [...]` list now also allows 'invite', 'rsvp', 'cancelled' (republish `out/firestore.rules`). No other rule changed.
- **Guests in the live game:** guest seat sees EVERY pod deck in Load a Deck (no name filter; only decks shared with the pod, never secret ones). Guests are charted but kept out of Chronicle `participants` (no feedback survey) and their deck result has `uid: null`. Guest seats show "(Guest)".
- **Cloud functions added:** `setSeatRsvp`, `setSeatDeck` (writes only `seats.N.deck`, so a deck load no longer overwrites rsvp/guest flags), `updateGatheringDetails`, `cancelGathering`, `loadOpenGatherings`/`watchOpenGatherings` (status in proposed|live), `notify` (returns true only if the write succeeded). `createGathering(podId, title, {status, seats, whenDate, whenTime, place})` writes everything in one document, so no half-made gatherings; it no longer logs the old pod-wide 'gathering' bell entry (the targeted invite replaces it).
- **Also fixed:** after confirming Remove in the live tray the tray used to vanish; it now reopens.
- **Tested:** Playwright with a stubbed multi-user cloud (host sends invites with a podmate, a decliner, a guest; empty guest name refused; invitee accepts from the My Pods card; another declines in the waiting room; host sees counts; guest deck picker unfiltered; Start clears the declined seat and goes live). Scores: 0 differences on the 159 precons. NOT tested against real Firebase or two real accounts.
- **Known limits:** replies and invites only reach people who open PodMates (no push/email); a declined podmate cannot be re-invited to the same seat except by Replace; `where status in [...]` queries need no index.

## Pass 22 (22 Oct 2026): X-spell commanders (Magus Lucea Kane report)
- Report: Magus Lucea Kane (copies the next spell or ability with {X}) decked with about 29 X cards read as "Supported / almost nothing tied to the commander". Cause: the centrality reading only knew type words, creature types, a short mechanics list and keywords; "X spells" was not a recognised thing the commander cares about.
- Centrality (`centralityFedCards`): new term 'X spells' (`xRe` on the commander text; a card is fed if its mana cost has {X} or it rewards X spells). Baseline `CENTRALITY_TERM_BASELINE['X spells'] = 0.03` (precon median 1.6%, 75th percentile 3.3%, 90th 6.5%). Fed X cards are linked to the commander in the centrality reading only (same treatment as keyword-fed cards: they still work alone, so they are not counted as orphans). The report deck now reads All-in.
- Key interactions: new plan `__plan_x` (`IXX`, `IXX_MIN = 8` X spells, or 5 when the commander rewards X) in `ixThemePlans`, and an "X spells" suggestion band: Copy or double X (Owlin Spiralmancer, Unbound Flourishing...), Copy a spell (instants and sorceries only; "cast or copy" cards, targets-only copiers and creature-only copiers excluded), More mana for X (genuine doublers/untappers only), Top-rated X spells.
- Bug fixed on the way: the deck's own commander could appear in "Cards you could add" when it was typed in the commander box (the pool now excludes commanders).
- Scores: 0 differences on the 159 precons (centrality is display only; X-commander precons will read higher).
- Still blind spots (same shape of problem, not yet built): commanders that reward "noncreature spells", "multicolored spells", "legendary spells", "kicker", "cast from exile" etc. Add them as terms with a measured baseline, as was done for X.

## Pass 23 (22 Oct 2026): Deck Crafter "Start New Deck" did not clear the list
- Cause: Start New cleared the saved draft and reopened the builder; with no draft, `openDeckBuilderOverlay` falls back to whatever is loaded in Deck Chart, so the chart deck was loaded straight back in ("sometimes" = whenever Deck Chart held a list). Reproduced (86 cards back) and fixed.
- Fix: `openDeckBuilderOverlay({ blank: true })` skips the Deck Chart fallback, and Start New also empties the in-memory `deckBuilderCards`/commander. A normal open with no draft still offers the Deck Chart list (by design), so closing and reopening an empty builder shows the chart deck again.

## Pass 24 (22 Oct 2026): Legendary-matters commanders (Shanid report)
- Report: Shanid, Sleepers' Scourge (pays you for casting legendary spells, gives other legends menace) with 39 legendary cards read as "Self-sufficient / almost nothing tied to the commander". Same blind spot as the X-spell report (Pass 22): a type-line supertype the commander cares about was not a recognised term.
- Centrality (`centralityFedCards`): new term 'legendary cards' (commander text mentions "legendary" or "legend rule"; fed = nonland card whose front-face type line has Legendary). Baseline 0.12 (precon median 11.7%, 75th 17.5%, 90th 23.8%, 97th 43.5%). Terms flagged `link: true` (X spells, legendary cards) are linked to the commander in the centrality reading only and are not treated as orphans. The report deck reads All-in.
- Key interactions: plan `__plan_legend` (`IXLG`; shows at 14+ legendary nonland cards making up 25%+ of the nonland cards, or 10+ when the commander rewards legends): lists cards that reward legends and legend-rule helpers. Suggestion band "Legendary matters": Cheaper legends, Find a legend, Duplicate legends (Mirror Box, Mirror Gallery...), Rewards legendary cards (legendary cards themselves only if top-rated).
- Scores: 0 differences on the 159 precons.
- Pattern for the next report: commander rewards a card property -> add a term to `centralityFedCards` with a measured baseline (check all 159 precons) and, if the deck is full of it, a plan in `ixThemePlans` plus a suggestion band. Still unbuilt: noncreature spells, multicolored spells, kicker, cast from exile, historic.

## Pass 25 (22 Oct 2026): Historic-matters commanders (Jhoira)
- Same pattern as Passes 22 and 24. Centrality term 'historic cards' (commander text mentions "historic"; fed = nonland card whose front-face type is artifact, legendary or Saga; baseline 0.30: precon median 29.5%, 75th 38%, 90th 63%). Plan `__plan_historic` (`IXH`, needs 18+ historic cards making up half the nonland cards, or 14+ and 40% when the commander rewards historic) and a "Historic matters" band (Cheaper historic spells, Rewards historic spells). The legendary plan is suppressed when the historic plan shows (legends are part of historic) unless the commander itself mentions legendary.
- Tested on the user's real Jhoira list (48 historic cards of 65 nonland; reads All-in; plan and "Historic matters" band show) as well as a synthetic one. 0 score differences on the 159 precons.

## Pass 26 — Commander properties: noncreature, creature, multicolored, kicker, cast-from-exile, cycling
- One table, `IXPROP` (engine-script, before `CENTRALITY_TERM_BASELINE`): key, label, `base` (about the 75th percentile share across the 159 precons), `cmd` (commander text), `test` (card), `pay` (cards that reward it), `cost` (cheaper ones), `top` (suggest top-rated cards of the property).
- Centrality: each property is a linked term (`link: true`) when the commander's text names it; baselines added to `CENTRALITY_TERM_BASELINE`. Edge reason reads "one of the <label> the commander rewards".
- Plan (`ixThemePlans`): `__plan_prop_<key>`, shown when >=5 hits and share >= base + 0.08 (noncreature therefore needs ~68%).
- Suggestions (`buildInteractionSuggestions`): band "<Label> matter" with Cheaper / Rewards / Top-rated groups.
- `pay`/`cost` are deliberately strict: "whenever you cast ..." triggers and "<type> spells you cast cost less" only (removal like "counter target multicolored spell", taxes like Thalia, and self-triggers like "when you cycle this card" are excluded).
- Tested on synthetic decks per property; regression hc5 = 0 differences over 159 decks.

## Pass 27 — Deck Crafter: two commanders
- Commander is still one string, now "First / Second" (the same form the main commander box takes), so Save and Chart need no special case. Helpers: `dbCmdNames()`, `dbIdentityCard()` (union of both colour identities, used by the off-colour warning, the colour filter and scanned-card adds).
- UI: once a commander is set, a "+ Add a partner or Background" button switches the commander search to second-commander mode; each commander has Change/Remove. `setDeckBuilderCommander`, `addDeckBuilderPartner`, `removeDeckBuilderCommander`.
- A pair that is not legal (both Partner, both Friends forever, Background + Choose a Background, Doctor + Doctor's companion) shows a plain note; it is not blocked.
- Known gaps: "Partner with <name>" pairs are treated as plain Partner; the search does not yet rank legal partners first.

## Pass 28 — Mill commanders
- Added a `mill` entry to `IXPROP` (Bruvac the Grandiloquent type): commander text names mill; term "mill cards", baseline 0.03 (p75 over 159 precons); `pay` = mill-doublers and "whenever a player mills" cards; plan `__plan_prop_mill`; suggestion band "Mill cards matter". Bruvac test deck: Self-sufficient -> Reliant. Regression 0 differences.
- Pass 28 addendum: half-library mill cards (Traumatize, Fleet Swallower, Cut Your Losses, Maddening Cacophony, Terisian Mindbreaker...) get their own "Mill half a library" line in the mill plan and a suggestion group (`half` regex on the mill IXPROP entry). When the commander doubles mill (`doubles` regex, e.g. Bruvac) the line says each one empties a whole library, i.e. they are the finishers.

## Pass 29 — Reset-email note
- Both password-reset confirmations (sign-in screen and My Profile) now say the link works once, lasts about an hour and only the newest email counts; the sign-in one also suggests copying the link into a private window if it says "expired". Cause of the September report: Firebase's standard single-use link, likely consumed by the user's mail provider scanner (unconfirmed).
- Combo write-ups checked for mill outcomes (Infinite mill, Exile each opponent's library, own-library ones): all read correctly.

## Pass 30 — Multi-column sort, My Profile table, decks-charted counters
- Tables share one renderer, `pmRenderDecksTable(tid)`, with state in `PM_TABLES[tid] = {rows, chain, touched, area}`. Sorting is a chain: the first tap replaces the default (Spark desc), further taps add levels in the order tapped, tapping a column already in the chain flips it, Clear resets. Header shows ▲/▼ and a level number; a "Sorted by: A ▲ → B ▼" line sits above. Row building is `pmAnalyzeDeckRows(decks)` (shared by Build Table and My Profile).
- My Profile: collapsible "My decks table" with a Build button (analysis only runs on press); own decks including secret ones, linked duplicates dropped.
- Decks charted counter = current saved-deck count (no lifetime counter, by decision). Player profiles and My Profile show "N decks charted" (own profile also notes "(K secret)"); the pod profile shows the pod total plus a per-player line (secret decks excluded there).
- Tested with synthetic rows (chain order, flip, clear) and 3 real precons; regression 0 differences; pw85/pw81 unchanged.
- Pass 30 addendum: My Profile's deck list is collapsed under "Show my decks (N)" (open during the welcome setup), and the Archetypes table on every player profile is collapsed under "Show archetypes (N)".

## Pass 31 — PriceScry: spoiler strip
- Top of the Signals tab: "Spoilers, last 10 days", a sideways-scrolling strip of card pictures built from `new_card` signals (deduped by card, newest first, up to 40; tap opens the card's price history). New-card rows in the list also carry a small thumbnail. The list's own window stays at 30 days.
- Pictures come from `psImgByName(name)`: Scryfall's `cards/named?exact=...&format=image&version=small` (answers with the image itself, front face), lazy-loaded. No printing id is needed, so spoilers work immediately. A card Scryfall has no picture for shows a name tile (strip) or no thumbnail (list). Option kept for later: have the daily job store the Scryfall id on each `new_card` event for exact pictures of future cards.
- Tested with synthetic signals (10-day cut-off, dedupe, fallback with the network blocked); regression 0 differences. Pictures themselves need the live network, so check them once on the real site.

## Pass 32 — Spoiler Bait
- Swipe through cards spoiled in the last 10 days: swipe left = like, right = bin (buttons, arrow keys and Undo also work). Tabs: Swipe (n left), Liked, Binned, Pod board. Liked/Binned lists have Move and Unsort; the Pod board lists every card the pod has sorted, most-liked first, with who liked and who binned it.
- Two entry points sharing one component (`sbMount`) and one set of votes (keyed by card name, `sbKey`): MyPod page button "Spoiler Bait" (overlay, mode `pod`, cards from a Scryfall search `(is:spoiler or date>=<10 days ago>) -is:reprint game:paper`, filtered by preview date; pod-facing text never mentions PriceScry) and a PriceScry "Spoiler Bait" tab (mode `ps`, cards from the recorded `new_card` signals; tapping a liked card opens its price history).
- Firestore: `users/{uid}/spoilerVotes/{card}` {key, n, setName, vote 'like'|'pass', votedAt}. Rules: owner writes; podmates (shared podIds, same test as decks) read — so votes are visible to the whole pod (decision: "Pod sees everything"). New rule block added to out/firestore.rules(.txt); it MUST be published. Cloud fns: setSpoilerVote, clearSpoilerVote, loadSpoilerVotes, loadPodSpoilerVotes.
- Tested with a stubbed cloud and Scryfall: queue, button and swipe decisions (left like, right bin, small drag ignored), undo, lists, move, pod board, PriceScry tab; regression 0 differences. Not tested live: the real Scryfall query and real Firestore reads.
- Pass 32 fixes: the swipe card is now sized from the screen height (`--sbw`, never taller than the pop-up) so the buttons stay in view; the card uses `touch-action:none` and the drag listens on the window (not just the card), with a 70px threshold, so touch swipes cannot be swallowed by scrolling; Like/Bin buttons have no sticky hover/focus fill, blur on tap and lock while the card flies off (130ms). Verified with real emulated touch events (CDP) at 390x780.

## Pass 33 — Spoiler Bait: "Bang" and rarity filter
- "Like" is now "Bang" everywhere users see it (button, stamp, tab "Bangers", pod board 💥). Stored votes are unchanged (`like`/`pass`), so nothing to migrate.
- Rarity chips (Common / Uncommon / Rare / Mythic / Special, with counts of unsorted cards, plus Show all) filter the Swipe stack and its count; the choice is remembered per device (`pm-sb-rarities`). Cards hidden by the filter stay unsorted, and the screen says how many are hidden. Scryfall-sourced cards carry `rarity`; PriceScry-sourced cards get it from one Scryfall collection lookup per 75 cards (`sbEnrichRarity`), and the chips stay hidden if that fails. `pricescry-snapshot.mjs` (handover copy) now also records `rarity` on new_card signals, so future cards need no lookup; it takes effect only once that script is uploaded to the repo.

## Pass 34 — Precon update (Nov 1, 2026)
- Added: Reality Fracture "Multiverse Reforged" (Jace, Multiverse Architect), Secret Lair "Odds and Ends" (Yennett, Cryptic Sovereign), and four Commander: Star Trek decks (Federation Fleet, Landing Party, Klingon Fury, We Are the Borg; release Nov 13, 2026). Lists from the official Wizards decklist pages (Multiverse Reforged cross-checked against mtg.wtf); each totals 100 and every card sits inside its commander's colours. Convention kept: `commander` is the face commander; the second featured commander stays in the 100.
- Star Trek decks carry `awaitsCards: true`: most of their cards are not yet in the card database, so at `dbReady` any such deck with more than 2 unknown cards is removed from `TRY_A_DECK_OPTIONS` and appears by itself after the next card-database rebuild. When it does, re-check them (names were taken from a summarised page; e.g. "Cha'DIch Investigator" may need its exact spelling) and add fingerprints (below).
- `PRECON_FINGERPRINTS` gained the two visible new decks (computed with the app's own `buildFingerprintVector`; reproduces an existing deck's vector exactly). Not done: the Star Trek fingerprints, and `REFERENCE_SCORES`/`REFERENCE_TIERS` (the percentile baseline) deliberately still describe the original 159 decks.
- Known older gaps in the precon list: Fallout (4), Commander Legends: Battle for Baldur's Gate (4), Foundations Commander Decks (5).

## Pass 35 — 13 missing precons and reference-set recalibration (Nov 1, 2026)
- Added Fallout (Scrappy Survivors, Hail Caesar, Mutant Menace, Science!; 2024), Commander Legends: Battle for Baldur's Gate (Draconic Dissent, Exit from Exile, Mind Flayarrrs, Party Time; 2022) and Foundations Commander Decks (Calling All Angels, Keen Engineering, Wretched Ranks, Reign of Dragons, Tramplesaurus Rex; released Oct 2, 2026, so year 2026). Lists from the official Wizards decklist pages; every card checked against the card database and each commander's colour identity.
- Fallout cards from the Vault set must use their full database names (e.g. "Vault 101: Birthday Party"). Fallout decks have one commander (the two legends are alternatives, both stay in the list). The four Baldur's Gate decks are stored as two commanders joined by " / " (both legends are in the 100).
- `PRECON_FINGERPRINTS` now covers all 174 visible decks. `REFERENCE_SCORES` / `REFERENCE_SPARK` / `REFERENCE_TIERS` grew from 209 to 224 rows: the 13 plus Multiverse Reforged and Odds and Ends, inserted as precons (rows 159-173). Percentiles and tier placements now compare against 168 precons, 36 tuned decks and 20 cEDH lists. The engine reproduced four existing rows exactly before the new rows were computed.
- Not re-fitted (fitted Oct 12 on 159/153 decks): centrality bands, spark band, the "0 of 153 precons" cEDH-style note. Revisit only if the new decks shift them noticeably.
- Star Trek (4 decks) still hidden by `awaitsCards`; once the card database includes the cards, add fingerprints and reference rows too.
- Regression 0 differences; Deck Crafter checks unchanged.

## Pass 36 — Bracket wording audit (Nov 1, 2026)
- Checked the bracket logic against Wizards' Oct 21, 2025 update (turn expectations: at least 9 / 8 / 6 / 4 turns for Brackets 1-4, Bracket 5 any turn; soft expectations, not strict limits; tutor restrictions removed) and the original Feb 2025 beta. Logic unchanged: Game Changers (1+ = B3, 4+ = B4), mass land denial = B4, a two-card win combo online by about turn five = B4, a slower one = B3, 3+ piece combos set no floor. The turn-five cut-off matches the six-turn expectation for Bracket 3.
- Extra-turn cut-offs (3 = B3, 5 = B4) are PodMates' own judgment (Wizards gives no number); the reasoning text and help text now say so.
- The bracket box and its help text now say: Command Spark is what PodMates uses for match-up fairness; the official bracket is for reference only.
- Audit finding, not changed: 65 curated two-card combos in `HARD_COMBOS`; 16 win by themselves (damage, drain, deck-out, kill) but 49 are infinite-but-need-a-payoff (mana, tokens, combat, turns, self-mill). Curated lines all count toward the bracket, while Commander Spellbook lines only count if infinite AND game-winning, so the two sources are inconsistent. Official text says "two-card infinite combos", which arguably includes the 49; decision pending.

## Pass 37 — House rule: any two-card infinite combo = Bracket 3 at least (Nov 1, 2026)
- Decision (Anthony): the rule is hard and fast. Any two-card infinite combo, from either the curated list or Commander Spellbook, moves a deck from Bracket 1-2 to at least Bracket 3. Previously the curated list counted everything and Spellbook lines only counted if infinite AND game-winning.
- Bracket 4 on speed is unchanged in spirit but now needs the line to win the game by itself (`winsAlone`; curated: `comboDisplayWin`, Spellbook: win class) and be online by about turn five. An infinite line that needs a payoff (mana, tokens, extra combat) gives Bracket 3 even if fast.
- The non-infinite curated line (Stuffy Doll + Guilty Conscience) no longer affects the bracket. 3+ piece combos still set no floor. Only the 6 strongest Spellbook lines per deck are recorded, so a weak infinite line could be missed in a deck that already has six better ones.
- Effect on the 174 visible precons: 5 move from Bracket 1-2 to 3 (Riders of Rohan, Blast from the Past, Family Matters, Living Energy, Goblin Storm), 1 moves from 4 to 3 (World Shaper). Counts now 141 / 24 / 9 (was 146 / 18 / 10). Spark and reference scores unaffected.
- Help text and reasoning updated to state the house rule.

## Pass 38 — Two-card infinite value loops now count for the Bracket (Nov 2, 2026)
- Trigger: a Tevesh Szat / Dargo deck showed fewer combos than Commander Spellbook. Cause: the snapshot builder (`spellbook-compact.mjs`) deliberately dropped "value loop" combos (infinite ETB/LTB/death triggers, commander casts, tokens...) with no win/warp effect. Dargo + Thermopod (a two-card infinite loop) was one of them; the three-card ones dropped (Culling the Weak + Saw in Half + Pinnacle Monk; Dargo + Pitiless Plunderer + Altar of Dementia) have no bracket effect and are still not shown.
- Builder change: two-card infinite loops are now kept as class 0 (code 4), added after the superset pruning and never used to prune, so a bigger win/warp line that extends a loop is still kept. Tested on a synthetic snapshot. Takes effect only after the Spellbook workflow is re-run and the new `spellbook-app-snapshot.json.gz` is embedded (the embedded snapshot is still the Oct 12 one, v2 without class-0 rows).
- App change: class-0 rows are never scored, never listed in the combo box, never used for near-miss suggestions. They are collected as `agg.infiniteLoopTwoCard` and counted in `detectBracketCore` as Bracket 3 floor only (never Bracket 4). Reasoning text updated. Tested by injecting a Dargo + Thermopod row: the Tevesh deck stays Bracket 3 with scores unchanged; a low-power Dargo deck with it becomes Bracket 3.
- Still true: the combo box lists the first 3 lines; the scores use up to 6 strongest Spellbook lines and merge near-duplicates.
- Embedded (Nov 2, 2026): new snapshot from export 7.3.4 (117,875 combos; 109,847 kept in the full snapshot). The zip from the workflow held only the full snapshot, so the compact app snapshot was built locally with the new `spellbook-compact.mjs`: 67,532 rows (win/warp lines plus 1,247 two-card infinite loops of class 0), 376,708 bytes gzipped. The embedded snapshot comment and `combo-data-script` header now say 2026-11-02 / 7.3.4.
- Effect: Dargo + Thermopod now sits in the Tevesh deck's bracket reasoning (stays Bracket 3, scores unchanged). Among the 174 visible precons, 12 total differ from before the two-card rules (all moves to Bracket 3 except World Shaper, 4 to 3): counts now 135 / 30 / 9. The six new ones come from two-card loops: Power Hungry, Mystic Intellect, Draconic Rage, Miracle Worker, Jeskai Striker, Blight Curse. Some of these loops need a specific game state in Spellbook; the app treats any two-card infinite combo as Bracket 3 by house rule.

## Pass 39 — "Key Pieces & Combos": one place for every combo (Nov 2, 2026)
- The panel `keyPiecesPanel` moved up to sit directly under Deck Profile and is renamed "Key Pieces & Combos". Like every info box it is closed by default and keeps its open/closed state while the user charts other decks (it is one static `details` element whose contents are replaced).
- Each combo now has its own framed block: Wins/Warps/card-count/Infinite tags, its own card pictures (101px, tap to enlarge), the result, "How it works" and "The cards" (roles), the earliest turn, and a one-line "Bracket effect" that mirrors `detectBracketCore` (3+ cards: none; two-card infinite: Bracket 3 at least; Bracket 4 only if it wins on its own and could be out by about turn five). Two-card infinite loops get their own group, then "One card away", then the Spellbook source note. Game Changers keep their pictures; fast mana, tutors and the rest are unchanged.
- Bracket box: the top-3 text lines and the pop-up button are gone; it now shows one line (wins / warps / loops) and a button `goToKeyPieces()` that opens and scrolls to the panel. The combo pop-up (`openCombosPopup`, `comboCardHtml`) was removed; its helpers were reused (`comboMergedItems`, `comboBlockHtml`, `comboLoopBlockHtml`, `comboNearHtml`, `comboSectionHtml`).
- The load message now reads "N combos (Spellbook lines that win, warp or loop)". N is the compact snapshot (67,532), not Spellbook's full export (117,875).
- Display only: regression 0 differences, no scores or brackets changed.
- Nov 2 follow-up: combo pictures enlarged from 86px to 101px (about 17%) on request; on a 390px-wide phone a three-card combo now wraps to two rows.

## Pass 40 — "Continue with Yahoo" sign-in (Nov 3, 2026)
- Added Yahoo as a sign-in method next to Google (a Yahoo user's password-reset emails were not arriving). Code: `OAuthProvider('yahoo.com')`, `PodmatesCloud.signInWithYahoo()`, a "Continue with Yahoo" button in the auth modal, "Yahoo" in the My Profile "Signs in with" line, and friendlier errors (pop-up blocked, account exists with a different method, method not switched on yet).
- Needs setup in Firebase and Yahoo (not in code): Yahoo Developer app giving a Client ID and Client Secret, with the redirect URI `https://podmates2027.firebaseapp.com/__/auth/handler`; both pasted into Firebase > Authentication > Sign-in method > Yahoo, then Enable and Save. Until then the button shows "This sign-in method is not switched on yet."
- Account merging: Firebase's default is one account per email. Yahoo sign-in with an email that already has a PodMates email/password account may merge or may show the "account exists" message; test with the real account before relying on it.

## Pass 41 — Sign-in "missing initial state" (Nov 3, 2026)
- A Yahoo user hit Firebase's "missing initial state" error (browser storage unavailable to the sign-in window: in-app browsers, private browsing, or storage-partitioned browsers). The pop-up flow works for the owner. `friendlyAuthError` now turns that error into plain advice (open in Safari/Chrome itself, leave Private Browsing, or use email and password). Not fixed in code: a permanent cure would need the auth domain to match the site's own domain (hosting setup), which is not planned. Waiting on the friend's device and browser.

## Pass 42 — Text sweep and baseline refit on 174 decks (Nov 3, 2026)
- Re-fitted on all 174 precon and curated decks: `STAPLES_BASELINE` (per-archetype medians, 33 cells changed), `MANABASE_BASELINE` (173 coloured decks), `CENTRALITY_SUPPORT_BASELINE(_BY_ARCHETYPE)` (overall recursion 1 -> 0). Backup: `index.before96.html`.
- Bug fixed: `computeManaBaseBenchmark` used `card.ci` (empty for Command Tower and similar) instead of `card.pm`, so the live fixing ratio disagreed with the stored baseline. Now uses `pm`.
- `CENTRALITY_BANDS` cut-offs moved 25/43/52 -> 27/45/56 to restore about 24/44/22/10% on 174 decks.
- Not re-fitted (judgment/percentile based): `CENTRALITY_TERM_BASELINE`, keyword baseline, spirit band, cEDH-capable thresholds, `IX_THIN_FLOORS`, impact-card "of 159 precons" counts (data built on 159), track-record expected-Spark offsets.
- Text: condensed Speed, Versatility, Disruption, Power Level, Win Condition, Bracket, Mana Base, Staples and Track Record explainers; counts updated (174 / 173); "Deck Compass" -> PodMates; removed the unverified "refreshed automatically every week" claim; "Pod Mates" -> "PodMates" in title, h1 and footer.
- Regression: 0 score differences; sanity scripts clean.

## Pass 43 — Second battle in a Gathering could not be logged (Nov 7, 2026)
- Bug: after Repeat Battle / Start New Battle, the Gathering still held the previous battle's `lastLoggedChronicleId`. The results listener read it as "this battle is already logged", so the host lost the Log Battle button and players got no feedback survey for game 2.
- Fix: `cloudMarkGatheringCharted` now clears `lastLoggedChronicleId`/`lastLoggedAt` in the same write as `chartedAt`; `currentBattleContext.ignoreChronicleId` (set when charting or repeating) makes the listener ignore the previous id even if that write failed.
- Not covered by an automated test (needs Firebase and two devices); needs a live check with a two-game Gathering.
