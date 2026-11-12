# Session p0-2 — Interim `CLAUDE.md` for the single-file app

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` task 0.5 and §5;
`docs/overview.md` §3.2 (anatomy of `index.html`), §3.3 (embedded datasets) and §5.1 (the data-revert bug).

## Task

Write a root `CLAUDE.md` (< 150 lines) for the app **as it is today**: one ~5 MB `index.html`. It must make
AI-assisted edits safe immediately. Include:

1. **What PodMates is** (2 lines) and links to `docs/overview.md` and `docs/refactor-plan.md`.
2. **Golden rules:** always start from the latest `main` (refactor sessions instead stack on their predecessor per
   `docs/refactor-plan/00-README.md`); never regenerate, re-download or re-upload the whole file;
   edit only the lines needed; never touch `const CARD_DB_COMPRESSED_B64 = …`, `const IX_TAGS_JSON = …` or
   `const COMMANDER_TIER_DATA = …` (weekly bots replace them); never change Firestore paths/field names; open a PR instead of pushing to `main`.
3. **Line map:** a table of the major regions of `index.html` (CSS, markup, card DB + lookup, engine/`analyzeDeck`,
   axis scoring, combos/spellbook, embedded datasets, Firebase/`window.PodmatesCloud`, each major feature, PriceScry).
   Generate it from the real file: find region start lines by grepping for distinctive identifiers/comments, and
   record the **identifier to search for** next to each approximate line number (line numbers drift; identifiers
   don't). Mark which lines are huge single-line data blobs that must not be printed in full.
4. **How to read the file:** use grep + ranged reads; never print the data lines.
5. **Gotchas:** e.g. card tuples are positional arrays, Pod "Impact card" edits only affect the Pod view line, the
   PriceScry password is a soft gate, keep User-Agents/delays for Scryfall/Playgroup/tcgcsv.
6. A note that this file will be replaced by the target version (plan Appendix A) during Phase 3.

Also add `AGENTS.md` and `.github/copilot-instructions.md`, each a 2–3 line pointer to `CLAUDE.md`.

## Out of scope

Any change to `index.html` itself.

## Done when

Every line number in the line map was checked against the current `index.html`. The PR description lists the commands
used to produce the map so it can be regenerated later.
