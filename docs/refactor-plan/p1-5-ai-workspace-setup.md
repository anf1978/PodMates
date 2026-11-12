# Session p1-5 — AI workspace setup (ADRs, glossary, Claude settings)

> **Done; hooks superseded.** The Claude hooks this session added were removed in #24 because they blocked
> sessions. Don't add hooks again; keep only the permissions, commands and docs parts.

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` §5.1–5.2 and §9.

## Inputs from the humans

Paste the agreed D1–D7 decisions here before starting (if any are still open, write the ADR with status "Proposed"):

```text
D1: …
D2: …
D3: …
D4: …
D5: …
D6: …
D7: …
```

## Task

1. `docs/adr/0001-…md` to `0007-…md`, one per decision: context, decision, consequences, status. Short (< 40 lines).
2. `docs/glossary.md`: Pod, Gathering, Chronicle, Bracket, Game Changer, Impact card, Spark, Centrality, precon, cEDH,
   Try-a-Deck, PriceScry, plus any other domain term you find in `docs/overview.md` / `index.html` UI strings. One or
   two lines each.
3. `.claude/settings.json`: allow `npm run *`, `npx vitest*`, `npx playwright*`, `git status`, `git diff`, `git log`;
   deny edits to `public/data/**` and any file with a `// GENERATED` header (path patterns). Hooks: after an edit,
   run Prettier + ESLint on the edited file (skip `index.html`); on stop, run `npm run check`.
4. `.claude/commands/`: `check.md`, `new-feature.md` (scaffold `src/features/<name>/` with `index.ts`, `view.ts`,
   `state.ts`, `<name>.css`, `<name>.test.ts`, following plan §5.2), `engine-change.md` (requires a golden diff + a
   written justification in the PR).
5. `.github/pull_request_template.md`: what/why, how verified (`npm run check`, e2e), golden diff explained (y/n),
   follow-ups.
6. Link the ADRs and glossary from `CLAUDE.md`.

## Done when

Hooks were tested in a session (or the PR explains how to test them). `npm run check` is green.
