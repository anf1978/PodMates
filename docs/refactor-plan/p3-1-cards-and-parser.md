# Session p3-1 — Cards, lookup and decklist parser → `src/cards`

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` §3 (principles), §4.2–4.3,
Phase 3 step 1, §5.2 (conventions).

## Task

1. Create `src/cards/` (strict TypeScript):
   - `tuple.ts`: a `CardTuple` type and **named accessors** for every positional field (no raw indexes elsewhere).
     Work out the field order from the decode code and `.github/scripts/build-card-db.mjs`.
   - `lookup.ts`: name normalisation, the indexes, `getCard(name)` etc., moved from `index.html` as-is.
   - `parse-decklist.ts`: the decklist parser (all supported formats: plain, Moxfield/Archidekt exports, set codes,
     sideboard/commander markers, etc.).
   - Integrate with the existing `db.worker.ts`.
2. Strangler pattern: `index.html` imports the module and assigns the same globals the legacy code expects (e.g.
   `window.getCard = getCard`) from one clearly commented `legacy-globals.ts` shim. Delete the moved code from
   `index.html`.
3. Unit tests: `parse-decklist.test.ts` covers every format the old parser handled (derive cases from the code
   branches), plus accessor tests.
4. Give each module the 2–3 line header comment from plan §5.2. Add a boundaries lint rule: `src/cards` may import
   only `src/shared`.

## Done when

- Golden unchanged; `npm run check` + `npm run e2e` green; new tests cover each parser branch.
- No raw tuple index (`card[3]`) remains in moved code.
