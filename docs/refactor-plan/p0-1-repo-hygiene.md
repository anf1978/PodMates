# Session p0-1 — Repo hygiene

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` Phase 0 (tasks 0.2, 0.4,
0.6) and `docs/overview.md` §5.

## Task

1. Delete stray files: `.github/scripts/index.html`, `.github/workflows/pricescry-probe.mjs`, and `test.txt`. First
   confirm nothing references them (grep the workflows and scripts).
2. Add `README.md`: one paragraph on what PodMates is, the live URL, where docs live (`docs/`), how data is refreshed
   (weekly workflows), and "how to contribute: see CLAUDE.md" (that file arrives in a parallel session — link anyway).
3. Add `.gitattributes` (`* text=auto eol=lf`; `*.png`, `*.gz`, `*.ico`, `*.webp` as `binary`) and `.editorconfig`
   (UTF-8, LF, 2-space indent, final newline; no trimming rule for `*.html` so the large data lines are never touched).
4. Repair mojibake (UTF-8 text decoded as Latin-1/Windows-1252, e.g. `â€”`, `â€™`, `Ã©`) in hand-written text in
   `index.html`, `docs/`, and `.github/`. Fix each occurrence surgically with targeted replacements. List every fixed
   string in the PR. Do **not** touch the base64/JSON data lines.
5. Bump every workflow under `.github/workflows/` to Node 22 (`actions/setup-node` `node-version: 22`). Check scripts
   don't rely on Node-20-only behaviour.

## Out of scope

Moving `firestore.rules` (Phase 4), any restructuring, tooling (`package.json` is the next session).

## Done when

- `git diff --stat` shows no change to the bot-managed data lines in `index.html` (check with
  `git diff -U0 index.html | grep -c CARD_DB_COMPRESSED_B64` → 0).
- Opening `index.html` locally (any static server) still loads the app and the chart works.
- Workflow YAML is valid (`actionlint` if available, otherwise careful review).
