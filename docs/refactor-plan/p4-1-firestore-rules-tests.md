# Session p4-1 — Firestore rules into `firebase/` with emulator tests

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` §4.5, Phase 4, §7;
`docs/overview.md` §3.5 (data model). Can run any time after p1-4.

## Task

1. `git mv firestore.rules firebase/firestore.rules`. Add `firebase/firestore.indexes.json` (from the console export,
   if a human has provided it; otherwise an empty `{"indexes":[]}` with a TODO in the PR) and `firebase/firebase.json`
   (emulator config only; this session must not deploy rules).
2. `firebase/rules.test.ts` using `@firebase/rules-unit-testing` + the Firestore emulator. Cover, for each collection
   in the data model: owner can read/write own `users/{uid}/**`; others can't (except the podmate-readable pieces such
   as `spoilerVotes` and mirrored decks); pod membership gates `pods/{podId}/**`; secret decks stay hidden from
   podmates; size/field limits matching `PM_LIMITS`; anonymous users can't do account-only actions.
3. **Don't change the rules.** If a test shows a real hole, mark that test `.fails`/`skip` with a `SECURITY:` comment
   and list it prominently in the PR for a human decision.
4. `npm run test:rules` (starts the emulator via `firebase emulators:exec`); add it to `ci.yml` (Java + firebase-tools
   in CI). Add `firebase/CLAUDE.md`: "rule changes need a rules test; never deploy rules from a session".

## Done when

Rules tests green in CI; the PR lists every rule branch and the test that covers it.
