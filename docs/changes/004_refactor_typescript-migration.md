# 004: The site was rebuilt as typed modules, with no change for users

Date: 2026-11-12

## Summary

Until November 2026 PodMates was one very large web page: every feature, all the card data and the scoring code sat
in a single `index.html` file, and weekly robots rewrote parts of that file to refresh the data. Between 10 and 12
November 2026 it was rebuilt piece by piece into small, typed TypeScript modules with automatic tests, without
changing what users see or how decks score. The data now lives in separate files, every change is tested before it
goes live, and the live site only ever runs a version whose tests passed. A saved copy of the old site is kept under
the `pre-refactor` tag, but it is an emergency option for the owner, not a normal way to undo changes.

## What users see

Nothing on purpose. Every move was checked to keep the page, the scores (golden snapshots of all 178 sample decks)
and the Firestore data byte-identical. The first visit after the switch downloads the new code and data once; after
that the site works offline for anything already loaded (service worker, `docs/deploy.md`).

## How it works

**Before** (tag `pre-refactor`, commit `d6b4d4c`, 2026-11-10): one `index.html` with inline `<script>` blocks for
every feature, globals on `window`, inline event handlers, and the card database, Tagger tags and commander tiers
embedded as base64 lines (`CARD_DB_COMPRESSED_B64`, `IX_TAGS_JSON`, `COMMANDER_TIER_DATA`) that the weekly
workflows spliced in on `main`. GitHub Pages served the file as committed; there was no build and no test gate.

**Now:**

- **Vite + TypeScript.** `index.html` is static markup and CSS with one module tag (`src/main.ts`) and the inlined
  theme pre-paint. Behaviour is strict TypeScript in `src/`, wired together only in `src/app/`. Nothing is
  published on `window`; lint enforces the layer rules.
- **Typed features.** Each user-facing area is a folder in `src/features/<name>/` with its own state, views, CSS and
  tests; docs `005` to `025` describe each one as it is today.
- **Data out of the page.** Static datasets are files in `public/data/`; the weekly bots publish `cards.json`,
  `tags.json` and `winrates.json` on the `data` branch, and the deploy copies them in. Big datasets load lazily.
- **Pipelines** are typed Node builders in `pipelines/`; code shared with the app is in `src/shared/`.
- **CI-gated deploy.** CI (typecheck, lint, unit, golden, e2e, Firestore rules tests, size budget) runs on every
  push. Deploy Pages publishes only a commit on `main` whose CI passed (`scripts/resolve-deploy-commit.mjs`), and
  green session branches merge themselves (doc `001`, ADR 0001).

Where everything lives: [docs/architecture.md](../architecture.md) and the `CLAUDE.md` map. How it was done, step
by step: [docs/refactor-plan.md](../refactor-plan.md) and the session prompts in
[docs/refactor-plan/](../refactor-plan/00-README.md) (R1–R17; stacked PRs up to #68, then #69 and #71).

No data changes: Firestore paths, field names and local storage keys are unchanged.

### The `pre-refactor` tag

`pre-refactor` marks the last commit before the refactor. The site owner keeps it as a **manual save point** in case
the humans ever decide to abandon the refactor entirely. Restoring it is a deliberate human decision, **not** a
normal rollback:

- It has no build step; it is the old hand-served `index.html`.
- Its embedded card data is stale and the weekly bots no longer splice data into it.
- Browsers that visited the new site run its service worker, which would keep serving the new build; it would need
  `scripts/sw-kill-switch.js` deployed first (`docs/deploy.md`, "Emergency kill switch").

Never deploy it as part of routine work. A normal rollback is `git revert` or Deploy Pages with an older `ref`.

## Testing

What guards the result: golden snapshots of all 178 sample decks (`npm run golden`), unit tests next to the code,
Playwright e2e on a production build (`npm run e2e`), Firestore rules tests (`npm run test:rules`) and the size
budget. All run in CI on every push.

On the live site: chart a sample deck from Try a Deck, sign in, open MyPods and PriceScry; each should look and
behave as before.

## Risks and rollback

The rebuild is spread over many merged PRs, so it cannot be reverted as one commit. Individual regressions are fixed
forward or reverted commit by commit. The full escape hatch is the `pre-refactor` tag described above, which only a
human decides to use.

## Follow-ups

- Some `src/app/` ports cast between structurally different feature types (Try-a-Deck and Gathering library rows,
  comparison and Gathering decks); a shared typed model would remove the casts (`docs/architecture.md`).
- Plan §10's boot-size target is unmet (`docs/deploy.md`).
- Pieces still missing from the repo (Worker source, knowledge/impact builders, corpus scripts, Firestore indexes)
  are listed under "Human-only tasks" in `docs/refactor-plan/00-README.md`.
- Found while writing the feature docs (none fixed here; docs-only session):
  - Scan Cards loads `tesseract.js@5` from jsDelivr by major version only, so a new 5.x release changes OCR
    without a deploy (`009`).
  - No unit test covers the deck form's Clear and Deck Name auto-naming (`006`), and no e2e opens View Deck or the
    Card Type galleries (`011`).
  - Stale header comments: `deck-crafter/index.ts` ("until p3-6") and `saved-decks/ports.ts` ("not a typed module
    yet") (`010`, `012`).

## Related

`001` (phone-first delivery), `002` (refactor-plan folder), `003` (auto-merge for `ccr-` branches); ADRs D1–D8;
feature docs `005`–`025`.
