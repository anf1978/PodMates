# Session p1-2 — Golden tests for the engine

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` task 1.2, §7 and principle
7 ("golden tests before moves"); `docs/overview.md` §3.2–3.3.

## Why

Before any engine code moves, its current output has to be pinned, so later sessions can prove they changed nothing.

## Task

1. Locate the DOM-free blocks in `index.html` that card lookup and `analyzeDeck` need: card DB decode/index, lookup,
   decklist parsing, engine, axis scoring, combos/spellbook, and any constants they read. Use the line map in
   `CLAUDE.md`.
2. If extraction by line number would be fragile, add **comment-only** markers around those blocks (e.g.
   `/* @golden:engine:start */` … `:end`). That is the only `index.html` edit allowed in this session.
3. Write `tests/golden/harness.ts`: read `index.html`, extract the marked blocks, run them in a Node `vm` context with
   the decoded card DB, and expose `analyzeDeck`.
4. **Pinned fixture:** build `tests/golden/fixtures/cards.json` (plus a spellbook subset if needed) that contains
   only the cards needed by the 174 embedded sample decks (Try-a-Deck), so weekly data refreshes don't move results.
   Commit the script that generates it (`npm run golden:fixture`).
5. `tests/golden/engine.golden.test.ts`: for every sample deck, snapshot the `analyzeDeck` result and all five axis
   scores (stable key order; round floats only if needed to avoid noise, and say so).
6. Scripts: `npm run golden` and `npm run golden:update`; include golden in `npm run check`.

## Out of scope

Moving or refactoring engine code. Fixing engine bugs (list them as follow-ups).

## Done when

- `npm run check` is green and the run takes under ~60 s.
- Sanity test: temporarily change one engine constant locally and confirm the golden test fails, then revert it.
  Describe this in the PR.
- Running golden twice gives identical snapshots (deterministic).
