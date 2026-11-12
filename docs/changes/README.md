# Change docs

Changes are pushed straight to `main` without review ([ADR 0001](../adr/0001-development-workflow.md)), so these
docs are the record of **what changed and why**. Every change ships with one numbered doc, in the same push as
the code. `tests/change-docs.test.ts` (part of `npm run check`) enforces the name, unique numbers and headings.

## Naming: `NNN_<type>_<slug>.md`

- **`NNN`**: three digits, the highest existing number + 1. If `git pull --rebase` brings in a doc with your
  number (another session pushed first), rename yours to the next free number and fix any links before pushing.
- **`<type>`**, one of:
  - `feature`: a new capability
  - `fix`: a bug fix
  - `change`: alters existing behaviour or looks
  - `refactor`: no behaviour change
  - `ops`: CI, deploy, tooling, data pipelines
- **`<slug>`**: lowercase kebab-case. A feature's first doc uses the feature folder name, for example
  `004_feature_pods.md`; later ones describe the change, for example `005_fix_appearance.md`.

Only trivial changes skip a doc: typos, formatting, dependency bumps. (A major-version dependency bump is not
trivial: it gets an `ops` doc.)

## Rules

- **Before changing a feature, read its docs here first** (search for the feature folder name).
- When a change alters something an earlier doc describes, add a last line `Later changes: NNN` to that earlier
  doc (append numbers, comma-separated, if the line already exists) so a reader can follow the chain. Don't
  rewrite old docs otherwise; they're history.
- Write the Summary for a non-programmer. The rest can be technical.
- Use `None.` for a section with nothing to say; don't delete the heading.
- An engine change that alters golden snapshots says in **Testing** why the diff is expected (`/engine-change`).

## Template

Copy this into `docs/changes/NNN_<type>_<slug>.md`:

```markdown
# NNN: Title in plain words

Date: YYYY-MM-DD

## Summary

What changed and why, in plain English for a non-programmer. Two to five sentences.

## What users see

What looks or works differently on the site, and where. "Nothing" for refactors and most ops changes.

## How it works

Files and modules touched and what each now does. Data: Firestore paths and fields, datasets
(`public/data/…`, the `data` branch), local storage keys, workflows. Say "no data changes" when true.

## Testing

Automated tests added or changed and what ran (`npm run check`, e2e, rules tests). How to try it on the
live site after the deploy, step by step.

## Risks and rollback

What could go wrong and who would notice. How to undo it: usually `git revert <sha>` and push; for an
instant fix, Actions → Deploy Pages → Run workflow with an older `ref`. Mention data that a revert would
not undo.

## Follow-ups

Deferred work or known gaps, or "None.".

## Related

Earlier change docs this builds on (`001`, …), ADRs, issues. "None." if it is the first.
```
