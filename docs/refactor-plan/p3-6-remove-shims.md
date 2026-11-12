# Session p3-6 — Remove shims and globals; final `CLAUDE.md`

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` Phase 3 step 5 + exit
criteria, Appendix A.

Requires every p3-5 feature run to be merged.

## Task

1. Delete `legacy-globals.ts`, the `window.PodmatesCloud` shim, the modal shims, and every remaining `window.*`
   assignment/read (except browser APIs). Replace leftover custom DOM events with the typed event bus where both ends
   are now modules.
2. `index.html` becomes a thin shell: static markup + `<script type="module" src="/src/main.ts">`. `src/main.ts`
   boots theme → card DB (worker) → cloud → UI.
3. Turn ESLint warn-only rules into **errors** (incl. `no-unsanitized`, boundaries, max-lines ~500 for
   hand-written source). Fix what fails; `checkJs`/`allowJs` off if no JS remains.
4. Replace the interim `CLAUDE.md` with the target version (plan Appendix A), adjusted to reality. Add
   `docs/architecture.md` describing the layers as built.

## Done when

- Plan Phase 3 exit criteria hold: no source file > ~500 lines, no globals, all Firestore via `services/cloud`, no
  `innerHTML` with interpolated data (`grep -rn innerHTML src` reviewed in the PR).
- Golden unchanged; `npm run check` + `npm run e2e` green.
