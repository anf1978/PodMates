# Firestore rules

Rule changes need a rules test; never deploy rules from a session.

Run `npm run test:rules` from the repo root with Node 22+ and Java 21+. It starts only the
Firestore emulator on `127.0.0.1:8184`, using the reserved `demo-podmates-rules` project.
No production credentials, Firebase login or `.firebaserc` are needed. Do not point the suite at
a real project or an existing emulator: it clears its test database between tests.

`rules.test.ts` covers authorization; `limits.test.ts` covers each field guard and compares the
server's limits with `PM_LIMITS`. See [coverage and known gaps](coverage.md).
`test.fails` cases document `SECURITY:` gaps in the unchanged rules, not accepted policy.
They must fail because of permission assertions, not setup or connection errors; an unexpected pass
requires reviewing the finding and promoting the test to an ordinary regression test.

`firestore.indexes.json` matches the production console (checked 2026-11-13): no composite indexes and no
single-field exemptions, only Firestore's automatic indexes. Every app query filters or sorts on one field, and
`tests/firestore-indexes.test.ts` keeps it that way; a query that needs a composite index must have it created
in the console first. The config exists only to run the emulator; no session may deploy it.
