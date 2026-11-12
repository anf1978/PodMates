# Session p6-2 (R17) — Backfill feature docs

Context: `docs/changes/README.md` (the change-doc convention from p6-1), `CLAUDE.md`, `docs/architecture.md`,
`docs/phone-workflow.md`.

## Workflow

Run this **after R16 (`p6-1-phone-first-delivery`) is merged**. It's the first session that uses the new
branch workflow instead of a stacked PR, and it doubles as the phone trial: ideally a human starts it from the
Claude iOS app. Follow Rule 1 in `CLAUDE.md` exactly: work on a `claude/` branch from the latest `main`, push it, and
follow it with `node scripts/ci-status.mjs` until it's merged and deployed (CI tests it; Auto-merge merges it). Note
anything in `docs/phone-workflow.md` that turned out wrong or unclear (sandbox setup, network, pushing, `gh`, the
status script, notifications), and fix it in a later branch.

## Why

The refactor moved every feature into `src/features/<name>/`, but none of them has a change doc yet. From now on
nobody reviews pushes, so the next session (or the developer reading on a phone) needs one place per feature that
says what it does and how it's built. This is a **docs-only** session: no behaviour changes.

## Task

1. **Refactor summary.** Write the next free number as `NNN_refactor_typescript-migration.md`:
   - What the site was before (one big `index.html` with inline scripts and embedded data) and what it is now
     (Vite + TypeScript modules, typed features, data on the `data` branch, CI-gated deploy).
   - Where things live now, in a few lines, linking `docs/architecture.md` rather than repeating it.
   - The **`pre-refactor` git tag**: the last commit before the refactor. It's a manual save point kept by the
     site owner in case the humans ever decide to abandon the refactor entirely. Restoring it is a deliberate human
     decision, **not** a normal rollback: it has no build step, its embedded data is stale, and the new site's
     service worker would need `scripts/sw-kill-switch.js`. Never deploy it as part of routine work.
2. **One feature doc per feature folder.** For every folder in `src/features/` (the list in the `CLAUDE.md` map),
   write `NNN_feature_<folder-name>.md` in the order that list gives, using the template from
   `docs/changes/README.md`. Describe the feature **as it is today**, from reading the code, not from the plans:
   - What users see and where it appears in the app (tab, button, modal).
   - Files and what each is for; the ports it gets from `src/app/`; the events it sends or listens to.
   - Data: Firestore paths and fields (from `src/services/cloud/` repositories), datasets, local storage keys.
     Copy paths and field names exactly.
   - Testing: its unit tests and e2e specs, plus how to try it by hand on the live site.
   - Gotchas and known gaps (including any listed in `docs/architecture.md`).
   - For `pricescry`, link `src/features/pricescry/CLAUDE.md` instead of repeating it.
   - If you can't tell something from the code, write `Unclear:` and what you'd need to know. Don't guess.
3. **Enforce it.** Add a test to `npm run check` that every `src/features/<name>/` folder has at least one
   `docs/changes/NNN_feature_<name>.md` (or `NNN_feature_<name>-<more>.md`). Check that `/new-feature` writes that
   doc for new features (p6-1 should have done this; fix it if not).
4. Mark R17 done in `docs/prompts/00-README.md`.

## Rules

- Docs and the one test only. Don't change code, styles, data or workflows. If you find a bug, list it under
  Follow-ups in the refactor-summary doc instead of fixing it.
- Ship in a few branches (for example one per group of features), each with green CI before the next starts from
  the new `main`.
- Keep each feature doc readable on a phone: aim for under ~150 lines, short paragraphs and lists.

## Done when

- Every feature folder has its doc, the refactor summary exists, and the new test passes.
- Every branch merged itself and `node scripts/ci-status.mjs` printed "Done" for the last one (CI green on `main`,
  deployed).
- Any fixes to `docs/phone-workflow.md` from the trial are pushed, and the final message lists what was hard to do
  from a phone.
