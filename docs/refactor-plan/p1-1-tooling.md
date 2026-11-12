# Session p1-1 — Tooling baseline

Follow the session rules in `docs/prompts/00-README.md`. Context: `docs/refactor-plan.md` §4.1 and task 1.1.

## Task

1. Add `package.json` (`"type": "module"`, `engines.node >= 22`, `private: true`) and lockfile. Dev dependencies:
   `vite`, `typescript`, `vitest`, `eslint`, `typescript-eslint`, `eslint-plugin-no-unsanitized`, `prettier`.
2. Vite serves the **unchanged** `index.html` (`npm run dev`, `npm run build`, `npm run preview`). Move static assets
   (icons, `manifest.webmanifest`) into `public/` only if the built output keeps the same URLs; otherwise leave them.
   Check that `vite build` does not rewrite, minify or break the large inline scripts. If it does, configure Vite to
   leave them alone (or copy `index.html` verbatim) and explain the choice in the PR.
3. `tsconfig.json`: strict, `allowJs`, `checkJs: false`, `noEmit`, `module`/`moduleResolution` for Vite.
4. ESLint flat config (`eslint.config.js`): typescript-eslint recommended + `no-unsanitized`. Legacy code is
   **warn-only**. Prettier config + `.prettierignore` that **excludes `index.html`**, data files and lockfiles.
   Reformatting the 35k-line file would destroy reviewable diffs.
5. Scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `test` (vitest run), and
   `check` = typecheck + lint + test. Add a trivial passing test so `check` is meaningful.
6. Make sure `.gitignore` covers `node_modules/`, `dist/`, `.env*.local`, Playwright output.

## Out of scope

Moving code out of `index.html`, CI workflows, golden tests (next sessions).

## Done when

- `npm ci && npm run check` is green, and `npm run build && npm run preview` serves a working app (chart works, no new
  console errors).
- `git diff main -- index.html` is empty.
- `CLAUDE.md` "Commands" section updated.
