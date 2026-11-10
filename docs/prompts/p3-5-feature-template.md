# Session p3-5 — Move one feature → `src/features/<name>` (template, run once per feature)

Follow the session rules in `docs/prompts/00-README.md`. Context: `docs/refactor-plan.md` §4.2–4.3, Phase 3 step 4,
§5.2; `docs/overview.md` §2 for what each feature does.

**Feature for this session:** `<FEATURE>` ← replace before starting.

Run order (one session and one stacked PR each, branch `p3-5-NN-<feature>` as in the stack order in
`docs/prompts/00-README.md`; split large ones into `-2`, `-3`… PRs, e.g. one per panel):

1. `deck-chart` (panels/*) 2. `try-a-deck`, `export`, `scan-cards` 3. `deck-crafter` 4. `auth`, `profile`
5. `pods` 6. `gatherings` 7. `chronicles` 8. `impact` 9. `spoiler-bait` 10. `trades` 11. `notifications`
12. `ledger`, `comparison` 13. `themes` 14. `pricescry` (lazy-loaded chunk via dynamic `import()`, with its own
`src/features/pricescry/CLAUDE.md` covering data branch, shard format, soft-gate note and KEEP-IN-SYNC helpers)

## Task

1. Find every piece of `<FEATURE>` in `index.html`: markup, CSS, JS functions, event listeners, globals and DOM
   events it listens to or dispatches. List them in the PR before moving anything.
2. Scaffold with `/new-feature <FEATURE>` (or by hand per plan §5.2): `index.ts` (public API + `mount()`), `view.ts`
   (lit-html templates via `src/ui/html.ts`), `state.ts`, `<FEATURE>.css`, `<FEATURE>.test.ts`.
3. Move the code, then:
   - replace `innerHTML` string building with `html` templates (auto-escaping); keep the DOM structure and classes
     identical;
   - Firestore access only through `src/services/cloud` repositories (not the `PodmatesCloud` shim);
   - inline `style="…"` → classes in `<FEATURE>.css` using tokens, except truly dynamic values;
   - no imports from other features. Use services or the typed event bus (`src/services/events.ts`; create it on
     first need);
   - keep a shim in `legacy-globals.ts` only for globals other *unmoved* legacy code still calls, with
     `// TODO(p3-6)` on each.
4. Delete the moved code from `index.html`. Update the `CLAUDE.md` map.
5. Tests: unit tests for state/logic; extend e2e with this feature's main happy path where feasible.

## Done when

- Golden unchanged; `npm run check` + `npm run e2e` green.
- No file in the feature folder over ~400 lines; no new `window.*`.
- Before/after screenshots of the feature's main views in the PR show no visual change.
