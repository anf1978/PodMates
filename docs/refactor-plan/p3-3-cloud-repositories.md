# Session p3-3 — Cloud layer → typed repositories

Follow the session rules in `docs/refactor-plan/00-README.md`. Context: `docs/refactor-plan.md` §4.5, Phase 3 step 2;
`docs/overview.md` §3.4 (cloud init) and §3.5 (data model).

**Hard rule:** Firestore paths, field names, document IDs and query shapes stay **exactly** the same. Real user data
depends on them.

## Task

1. Install the Firebase modular SDK from npm on the **same major version** as the CDN import in `index.html`.
2. `src/services/cloud/firebase.ts`: app/auth/firestore init (same config), anonymous sign-in, and the
   `podmates-cloud-init` event. This is the only file that imports `firebase/*`.
3. One repository per collection (`decks.ts`, `linked-decks.ts`, `pods.ts`, `members.ts`, `gatherings.ts`,
   `chronicles.ts`, `activity.ts`, `impact.ts`, `spoiler-votes.ts`, `trades.ts`, `table-formations.ts`, `users.ts`),
   with typed document interfaces derived from what the current code reads and writes. Move `PM_LIMITS` here.
4. Rebuild `window.PodmatesCloud` as a **shim** that delegates every existing function (~90) to the repositories with
   the same signatures and return shapes. Include a checklist in the PR showing every original function is mapped.
5. Unit tests with mocked Firestore for path construction and data mapping (at least one per repository).
6. Lint boundary: only `src/services/cloud/**` may import `firebase/*`.

## Done when

- `npm run check` + `npm run e2e` green.
- Manual check on a preview build: sign in, load saved decks, open a pod, view a gathering. Record the result in the
  PR. Emulator e2e comes in p4-1.
