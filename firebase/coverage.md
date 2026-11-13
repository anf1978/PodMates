# Rules coverage and decisions

`npm run test:rules` loads the unchanged rules into an isolated demo-project emulator.
`rules.test.ts` tests get/list, create/update/delete authorization; `limits.test.ts` tests field
boundaries. Signed-out tests deny every operation on all 13 modeled document patterns.
Unmatched paths (including deeper user descendants) have explicit default-deny tests.
Expected failures below are **unresolved security/policy decisions**, not passing policy checks.

## Every rule branch

| Match / branch                                                                                                                               | Test in `rules.test.ts` (parameterized names include the path/role)                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users/{uid}` read; create/update; delete                                                                                                    | `user ownership`: owner CRUD, outsider denials                                                                                                                                                |
| `users/{uid}/decks/{id}` owner read; shared-pod non-secret read; secret denial; owner create/update/delete                                   | `user ownership`: CRUD; `podmates read votes and non-secret mirrored decks`; missing/disjoint `podIds`; filtered and unfiltered list                                                          |
| `users/{uid}/trades/{id}` read/create/update/delete                                                                                          | `user ownership`: CRUD, private collection list denials                                                                                                                                       |
| `users/{uid}/spoilerVotes/{id}` owner/shared-pod read; owner create/update/delete                                                            | `user ownership`: CRUD, shared reads/list, non-owner writes denied; vote enum in `limits.test.ts`                                                                                             |
| `users/{uid}/linkedDecks/{id}` read/create/update/delete                                                                                     | `user ownership`: CRUD, private collection list denials                                                                                                                                       |
| `pods/{id}` read; create with matching leader; update as leader/co-leader/incoming/current member; leader delete                             | `pods and members`: role updates, current-member self-removal, creation and delete roles; outsider read/self-join are expected failures                                                       |
| `pods/{id}/members/{uid}` read; create/update/delete as self/leader/co-leader                                                                | `pods and members`: all three manage roles, ordinary-member/outsider denials; outsider read/self-creation are expected failures                                                               |
| `tableFormations/{id}` member read/create/update/delete                                                                                      | `member-gated collections`: read/list, outsider denials, member CRUD                                                                                                                          |
| `chronicles/{id}` member read/create; update/delete via `canManageChronicle`                                                                 | `member-gated collections`; `chronicle management`: leader/co-leader/participant, empty/missing participants, nonparticipant and removed-member denials                                       |
| `settings/{id}` member read; impactCards-only leader/co-leader create/update; leader-only delete                                             | `member-gated collections`; `impact settings`: valid roles, invalid setting id, missing changes, member denial, co-leader delete denial and leader delete of any setting                      |
| `impactNominations/{id}` member read; create with member/author/string-card checks; author-preserving update; author/leader/co-leader delete | `member-gated collections`; `nominations and activity`: valid/forged authors, missing/non-string card, author transfer denied, all delete roles; removed-author update is an expected failure |
| `activity/{id}` member read/create with matching author and allowed type; update always false; author/leader/co-leader delete                | `member-gated collections`; `nominations and activity`: all eight types, missing/invalid type and forged author, all update/delete roles                                                      |
| `gatherings/{id}` member read/create/update/delete                                                                                           | `member-gated collections`: read/list, outsider denials, member CRUD                                                                                                                          |

`limits.test.ts`'s `every server field guard` table enumerates **every** `okStr`, `okList`
and `changes` map guard: exact maximum succeeds, maximum + 1 and wrong type fail, optional
missing/null branches succeed (map null and required nomination card fail). Both create and update
are exercised, except immutable activity; `notesEditedBy` has its own update test.
Nomination card checks and vote/type enums have dedicated cases.

## SECURITY: findings requiring human review

The suite uses `test.fails` with `SECURITY:` comments. It remains green while these desired denials
fail; fixing a gap requires converting the corresponding test into a normal regression test.

| Finding                                                                                                     | Expected-failure test                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Any authenticated outsider reads pod documents and member records                                           | `outsider cannot read` (both paths)                                                                     |
| A user can forge their own `podIds` to read another user's non-secret decks/votes without actual membership | `forged shared podIds cannot expose`                                                                    |
| Outsiders can self-join by rewriting `memberIds`; members can take leadership                               | `outsider cannot self-join`; `ordinary member cannot take leadership`                                   |
| Outsiders can write their own member record in any pod                                                      | `outsider cannot create their own member record`                                                        |
| Removed nomination authors can still update                                                                 | `removed nomination author cannot update`                                                               |
| Firebase anonymous accounts can perform account-only writes at every modeled path                           | `anonymous account cannot write account-only` (13 paths, anonymous provider claim)                      |
| Server ceilings exceed browser `PM_LIMITS`                                                                  | `server limits do not match PM_LIMITS` table, one case per mapped field                                 |
| Chronicle `notesEditedBy` has no create guard, and its update limit exceeds the client's                    | Two named `notesEditedBy` expected failures                                                             |
| Decklist line count, trade key/quantity/price, feedback bestMoment, impact reason/add count are client-only | `rejects unguarded client limit` table                                                                  |
| Saved/linked deck, trade, formation and chronicle document-count limits are client-only                     | `document-count ceilings exist only in the client`: seed exactly at each ceiling, then attempt one more |

Examples of divergent ceilings: names 40/80 (client/server), pod name 60/120, decklist
30,000/40,000, podIds 10/40, pod members 30/40, feedback responses 24/48 and impact changes 60/70.
The test table imports `PM_LIMITS` rather than duplicating client ceilings. Not every PM limit maps
to a persisted field: `builderMaxCards`/`builderMaxQty` describe local builder state, not a rules field.
Server-only/literal field ceilings (e.g. vote metadata and nomination card/note) are tested separately.
This is branch/behavior coverage, not an exhaustive audit of every unvalidated nested field.

## Indexes and deployment

Production indexes were read from the Firebase console on 2026-11-13 (project `podmates2027`): automatic
single-field indexes at their defaults (ascending, descending and array-contains enabled for collection scope,
collection-group scope disabled), no single-field exemptions and no composite indexes.
`firestore.indexes.json` now states exactly that (`"indexes": []`, `"fieldOverrides": []`). The app needs no
more: every query in `src/services/cloud` filters or sorts on a single field (`memberIds`, `inviteCode`,
`createdAt`, `secret`, `status`) and none is a collection-group query. The emulator does not enforce
indexes, so `tests/firestore-indexes.test.ts` checks the queries statically and fails if one starts to need a
composite index. No rules or indexes were deployed.
