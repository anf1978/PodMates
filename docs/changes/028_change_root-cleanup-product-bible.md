# 028: Tidy the repo root; keep the Product Bible as a history doc

Date: 2026-11-12

## Summary

The top folder of the repository held leftovers: copies of the app icons and manifest that were only needed
before the site moved to the new deploy, a duplicate of a data script, and the old "Product Bible", the long
handover document from before the rebuild. The duplicates are removed. The Bible is kept, unchanged, in
`docs/history/` with a note saying it is a frozen record. The few rules in it that still apply (how brackets are
decided, PriceScry's trading rules) are copied into the current docs where developers will find them.

## What users see

Nothing. The live site's icons and manifest come from `public/` and are unchanged.

## How it works

- **Removed** (byte-identical duplicates):
  - `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `manifest.webmanifest`
    duplicated `public/`. Hotfix #15 restored them while Pages still served the branch and said to remove them once
    Pages used GitHub Actions, which it now does.
  - `spellbook-compact-2026-11-10.mjs` duplicated `pipelines/spellbook/spellbook-compact.mjs`. Its ignore entry in
    `eslint.config.js` and its mention in `docs/architecture.md` are gone.
- **Moved:** `PodMates-Product-Bible-2026-11-10.md` → `docs/history/product-bible-2026-11-10.md`, unchanged apart
  from a banner. The banner says the doc is frozen and that the current docs win where they disagree.
  `docs/history/` is in `.prettierignore` so a formatter never rewrites it.
- **Compared** with the current docs, the Bible's architecture (one HTML file, deploy from `main`, `window`
  globals), file layout (`.github/scripts/`), workflow ("Claude delivers complete files") and known-issues sections
  are out of date. Its feature, data-model and PriceScry-internals sections duplicate `docs/overview.md`, the feature
  docs `005`–`026`, `src/services/cloud/` and `src/features/pricescry/CLAUDE.md`. Only its decision history is
  unique, so it was not folded in wholesale.
- **Folded in** (rules still in force, checked against the code):
  - `src/engine/CLAUDE.md`, new "Decisions behind the rules": bracket timing (turn five, extra turns), the
    two-card infinite house rule and value-loop floor, no Bracket 5, banned cards out of scoring, Spellbook in the
    scores, default impact points with no taper, and precon-only offsets and baselines.
  - `src/features/pricescry/CLAUDE.md`, new "Standing decisions": Japan-only buying, the one-in-three riser gate
    (`pShow: 0.33`), the Mercari cost bar (`japanCostModel` / `COSTS`), no scraping, and the honest User-Agent.
- **Links updated:** comments in `src/engine/centrality-rules.ts`, `pipelines/pricescry/pricescry-bulkjump.mjs` and
  `pipelines/reference-corpus/recovered/README.md` point to the new path; `docs/overview.md` and the `CLAUDE.md`
  header link the history doc.

No data changes; comments only in code.

## Testing

CI (`npm run check`, build and budget, e2e). The build serves icons and the manifest from `public/`, so the PWA
and accessibility e2e still cover them. By hand after the deploy: on a phone, the home-screen icon and the "New
version available" banner still work.

## Risks and rollback

If something did read the root icons, it would 404; nothing in the build, scripts or workflows references them
(checked). `git revert` restores everything. To roll back to branch-served Pages, `docs/deploy.md` already says to
copy the five files back from `public/`.

## Follow-ups

None.

## Related

`004` (refactor summary), `020` (baselines rebuilt from recovered scripts), PR #15 (the root-asset hotfix).
