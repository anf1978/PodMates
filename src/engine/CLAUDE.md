# src/engine — deck analysis (pure)

`analyzeDeck` and everything it calls: classification (`classify.ts`, `patterns.ts`), synergy, combos and
Spellbook matching, mana, the five axes (`axes/*.ts`), brackets, Command Spark, table feel, win condition,
commander win-rates and Commander Centrality. Hand-curated tables live in `src/data/*.ts`
(`HARD_COMBOS`, `SOFT_SYNERGIES`, `GAME_CHANGER_REASONS`, `DEFAULT_IMPACT_CARDS`, curated card sets).
Import from `index.ts`; it is the public surface.

## Purity rules (lint-enforced)

- No DOM, `window`, `document`, `fetch`, storage, `navigator` or other page globals.
- No module-level mutable state: top-level bindings are `const`, and tables are read-only. Caches belong
  on an `EngineContext` (see `createEngineContext`), never in a module variable.
- Everything besides the deck comes in through `EngineContext`: the card database, the Spellbook index
  (`null` means curated combos only) and commander win-rates. Callers build one with
  `createEngineContext({ cards, spellbook, winRates })` and pass it as the first argument of the
  context-dependent functions (`analyzeDeck`, `computeCommanderCentrality`, `lookupCommanderTiers`,
  `parseCommanderField`, `resolveCommanderName`). Other exports are plain functions of their arguments.
- Imports: only own files, `src/cards`, `src/data` (not the dataset loader) and `src/shared`.
- Inputs are never mutated. `tests/golden/harness.test.ts` re-runs every sample with deep-frozen
  inputs, in reverse order, and requires identical results.
- Keep each file at or under about 400 lines; split by responsibility rather than growing one file.

## The legacy shim

`legacy-globals.ts` is the only engine file allowed to touch `window`. It republishes the engine under
its original global names for the inline scripts, dropping the context argument: each call builds (and
memoises) a context from the page's `CARD_DB`, `SPELLBOOK_INDEX` and `COMMANDER_TIER_DATA`; typed
callers can import that `pageContext()` instead of reading globals. It is imported by `src/main.ts` (so
globals exist before `DOMContentLoaded` and the cloud modules) and is also awaited by `initDatabase`. Add a name there only when inline code needs it; delete names as callers move to
`src/features`.

## Golden tests

`tests/golden/harness.ts` imports these modules directly and analyses every Try-a-Deck sample with the
pinned `tests/golden/fixtures/` cards, Spellbook and win-rates (never the live weekly data). The
snapshot covers the full analysis and all five axis scores. A refactor must leave it byte-identical.

- `npm run golden` runs it; `npm run check` includes it.
- **Intentional score or analysis changes need `/engine-change`** (`.claude/commands/engine-change.md`):
  add a focused test, run `npm run golden:update` only when changed results are authorised, and explain
  the reviewed diff in the PR. Never update the snapshot to make a refactor pass.
- `npm run golden:fixture` re-pins fixtures from the local data files and proves full-data parity;
  run it only deliberately.
- `mana.test.ts` checks that `mana.ts` agrees with the copy between the `SHARED MANA-PRODUCTION LOGIC`
  banners in `pipelines/card-db/build-card-db.mjs`. Change both together and keep the banners.

## Calibration notes (from the code)

Scores are calibrated against the reference corpus (`REFERENCE_SCORES` / `REFERENCE_TIERS`, used by
the app for percentiles). Changing `PATTERNS`, weights, thresholds or curated tables moves every deck.

- **Spirit bands** (`spark.ts`): re-fitted Oct 12, 2026 against 153 precons, 36 tuned decks and 20 cEDH
  lists; the tool-signal count carries the bands together with Spark (123/153 precons Core, 34/36 tuned
  and all cEDH Tuned).
- **cEDH-capable flag** (`brackets.ts`): not a Bracket 5 band. Fitted Oct 12, 2026; true for 18/20 cEDH,
  10/36 tuned, 0/153 precons.
- **Centrality support medians** (`centrality-rules.ts`): medians of the 174 PodMates precon and curated
  decks, re-fitted Nov 3, 2026; the band thresholds' expected distributions are noted beside them.
- **Power Level** (`axes/power-level.ts`): Game Changers alone must not saturate the axis (about 16 reach
  the per-term cap).
- **Expected Spark by win-rate tier** (`commander-tiers.ts`): the band is deliberately wide. Archetype
  offsets (regenerated Oct 12, 2026) only nudge its centre, damped because the corpus is precon-weighted.
- Pod "Impact card" edits only affect the separate Pod view line, never these scores.
