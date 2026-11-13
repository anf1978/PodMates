# 029: Record the live Firestore indexes and keep queries within them

Date: 2026-11-13

## Summary

The repo's database index file was an empty placeholder because nobody had checked the live Firebase project.
The owner checked it in the Firebase console. It uses only Firestore's automatic indexes, with no custom ones,
and every query the app makes works with those. The file now says so, and a new test warns if a future change
writes a query that would need a custom index, which would otherwise only fail on the live site.

## What users see

Nothing.

## How it works

- `firebase/firestore.indexes.json`: `{"indexes": [], "fieldOverrides": []}`, the export form of what the
  console shows for project `podmates2027` on 2026-11-13. That is automatic single-field indexes at their defaults
  (ascending, descending and arrays for collection scope; collection-group scope off), no exemptions and no
  composite indexes. Never deployed from a session.
- `tests/firestore-indexes.test.ts` reads every `query(...)` in `src/services/cloud` and fails if one filters or
  sorts on more than one field, or if any code uses `collectionGroup`. Today's queries each use one field:
  `memberIds` (array-contains), `inviteCode`, `createdAt` (orderBy + limit), `secret`, `status` (== / in).
- Docs: `firebase/coverage.md` (the "TODO (human)" is closed), `firebase/CLAUDE.md`, `docs/architecture.md`,
  `docs/overview.md`.
- No Firestore paths, fields or rules change. No data changes.

## Testing

`npx vitest run tests/firestore-indexes.test.ts` (part of `npm run check`). It includes a self-check that the
parser flags a two-field query.

## Risks and rollback

A query written in an unusual form (for example built in a helper outside `query(...)`) could slip past the
static check. The live site would then show a "requires an index" error for that feature. Undo with
`git revert <sha>`.

## Follow-ups

- Record the Authentication settings (sign-in providers, authorised domains).
- If a feature ever needs a composite index: create it in the console first, add it to the JSON and relax the
  test for that query.

## Related

020 (recovering missing pieces, same audit).
