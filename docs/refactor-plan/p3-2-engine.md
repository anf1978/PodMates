# Session p3-2 — Engine → `src/engine` (pure)

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` principle 3 ("the engine is
pure"), §4.2, Phase 3 step 1, §7.

This is the highest-risk move. If the diff gets large, split it into several PRs (e.g. mana/brackets → combos/spellbook
→ axes → `analyzeDeck`) and say in each PR which part is done.

## Task

1. Move `analyzeDeck` and everything it calls into `src/engine/`: `analyze.ts`, `axes/*.ts` (one per axis),
   `brackets.ts`, `combos.ts`, `mana.ts`, `centrality.ts`, `archetype.ts` (adjust names to the real code). Hand-curated
   tables (`HARD_COMBOS`, `SOFT_SYNERGIES`, `GAME_CHANGER_REASONS`, `DEFAULT_IMPACT_CARDS`) go to `src/data/*.ts`.
2. **Purity:** no DOM, `window`, `fetch`, `localStorage`, or module-level mutable state. Inputs (decklist, card
   lookup, spellbook index, win-rates, baselines) are passed in explicitly, e.g. an `EngineContext` object. Strict
   types for the result object.
3. Golden tests now **import the modules directly**; delete the `vm` extraction harness and the `@golden` markers.
   Snapshots must stay byte-identical. Do not run `golden:update`.
4. Legacy code keeps calling `window.analyzeDeck(...)` through the shim, which builds the context from the current
   globals.
5. Add `src/engine/CLAUDE.md`: purity rules, how golden tests work, "intentional score changes need
   `/engine-change`", and calibration notes found in code comments.
6. Lint boundary: `src/engine` imports only `src/cards`, `src/data`, `src/shared`.

## Done when

Golden snapshots byte-identical; `npm run check` + `npm run e2e` green; no file in `src/engine` over ~400 lines.
