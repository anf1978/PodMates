# 037: Weekly precon importer for Try a Deck

Date: 2026-11-13

## Summary

New official Commander precons no longer have to be typed in by hand. Every Monday, after the card database
refresh, a GitHub workflow checks MTGJSON (a public database of every Magic product) for Commander precons that Try
a Deck doesn't have yet. When it finds some, it prepares them with suggested labels, re-runs every check, and opens a
pull request asking the owner to review it. Nothing ships until someone taps **Merge**. After that the decks are in
Try a Deck, signed-in players get a "New in Try a Deck" notice (036), and the decks join the Closest Match,
staples, mana-base and percentile comparisons.

## What users see

Nothing until an import pull request is merged. Then: the new decks in Try a Deck and the bell notice.

## How it works

- `pipelines/precons/import-precons.mjs` reads MTGJSON's deck and set lists. Candidates are Commander decks released
  on or after `IMPORT_SINCE` (2026-11-01) that aren't already in Try a Deck (same name, `cmd<year>-<slug>` key, or
  same commanders). It fetches each candidate's deck file (1 s apart, identified User-Agent) and requires exactly
  100 cards with every card in the latest card database. Each new entry gets `key`, `flavorName`, `commander`
  ("A / B" for partners), the decklist (commanders first), `source: "precon"`, `year`, `setName`, `addedAt`
  (today), and suggested `archetype` (the closest existing precon's, via `computeArchetypeMatch`), `style`
  ("<colour name> <archetype>") and `tagline` ("A <year> Commander precon from <set>, led by <commander>."). It
  refreshes `TRY_A_DECK_METADATA` and both manifest entries and writes the report and a numbered change doc.
  Unreleased decks and decks missing cards are listed as "Waiting" for a later run; malformed ones as "Skipped".
- `tests/golden/generate-fixture.mjs --add <cards.json>`: pins only the new decks' cards. Already-pinned cards keep
  their exact data and order (new cards are appended), and full-data parity is checked against that overlaid
  database. `src/shared/mana-production.test.ts` now digests the original 7621 pinned cards (more may follow), and
  `engine.golden.test.ts` requires at least 178 samples instead of exactly 178.
- `pipelines/reference-corpus/benchmark-baselines.mjs --from-fixtures` builds from the pinned fixtures, exactly
  what its test checks. New decks join the fingerprints, baselines and reference set (`p` rows).
- `pipelines/precons/snapshot-guard.mjs` fails if an import changes or removes any existing golden snapshot, so
  only additions get through.
- `.github/workflows/precon-import.yml` runs after a successful `Rebuild Card Database` on `main`, plus manual
  dispatch. Steps: card DB from the `data` branch (else the committed one) → import → fixtures → benchmarks →
  golden snapshots plus guard → `npm run check` → force-push `wip/precon-import` → open or update the pull
  request with the owner as reviewer → dispatch CI. It never merges. Permissions: `contents`, `pull-requests` and
  `actions` write, no secrets.
- Explainer texts for Closest Match and Mana Base no longer quote deck counts that each import would make stale.
- No Firestore changes.

## Testing

- `pipelines/precons/import-precons.test.mjs`, with a fake MTGJSON built from real fixture decks: adding a
  complete new deck with labels; skipping known, unreleased, card-missing and short decks; never fetching old or
  non-Commander decks; refusing malformed lists; key and decklist helpers; the generated change doc carries every
  required heading (also checked against the real change-doc test).
- `pipelines/precons/snapshot-guard.test.mjs`: reads the real golden file; additions pass, edits and removals fail.
- Rehearsal in a scratch copy of the repo: a simulated precon (commander not yet pinned) went through fixtures (7621
  → 7622 cards, parity verified), benchmarks, 1 snapshot written, guard OK (178 unchanged), and `npm run check`
  green (785 tests).
- Not tested from the sandbox: live MTGJSON, which this session's network couldn't reach. The first workflow run's
  report (Actions Summary, or the pull request) shows which recent decks it matched as "Already in Try a Deck".
  Check that before merging the first import.

## Risks and rollback

- The suggested labels can be wrong; they're shown in the pull request to edit. An MTGJSON name that differs from
  ours could look new and become a duplicate; the "already present" checks (name, key, commanders) make that
  unlikely, and the report shows it.
- This change adds a workflow file, so Auto-merge can't push it: it opens a pull request for a human to merge
  (the one-time manual merge).
- Disable by turning the workflow off in Actions; revert with `git revert <sha>`.

## Follow-ups

- Confirm on the first run that MTGJSON lists the 2026 precons we already have (they should appear under "Already
  in Try a Deck").

## Related

034, 035 (benchmarks and reference set), 036 (Try-a-Deck notices), 007 (Try a Deck).
