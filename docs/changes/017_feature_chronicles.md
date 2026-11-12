# 017: Chronicles (the pod's battle journal)

Date: 2026-11-12

## Summary

Chronicles is the pod's shared diary. When the host of a Gathering logs a battle, its decks, players and scores
are saved as an entry, grouped under the Gathering's title, newest first. Players can add notes and, after a
battle, rate how fun it was and how well PodMates predicted the table, and write the best moment. Every member can
read the journal. This feature also owns the post-battle buttons: **Log Battle**, **Repeat Battle**, **Start New
Battle** and **End Gathering**.

## What users see

- **Chronicles & Stories** panel on the MyPods tab (`#matchHistoryPanel`): "Your active pod's shared nights,
  grouped by Gathering…", the entries (date, decks with commander, player and Spark, notes, average ratings and
  highlights), **Add notes** / **Edit notes** and delete for participants and Stewards, and **Clear Chronicles**
  (Steward only, confirmed). Guests can read; editing asks them to sign in.
- **Under a charted Gathering battle** (`022`): the host sees **Log Battle** (with a confirm); others see "Waiting for
  <host> to log this battle." After logging: "Battle logged. What's next?" with **Repeat Battle**, **Start New
  Battle** and **End Gathering** (host only).
- **"How was the battle?"** (non-hosts, once per new logged result): **Fun** and **Alignment accuracy** ratings, **Best
  moment**, **Submit** or **Skip** (skipping writes nothing).

## How it works

- `index.ts`: `configureChronicles(runtime)`, `mount()`, `renderMatchLog()`, `refreshCloudChroniclesCache()` (loads
  entries and your role for the active pod; a version counter drops responses from an earlier pod or account; load
  failures report and leave an empty list), the notes editor, delete, clear and the feedback survey.
- `battle.ts` + `battle-view.ts`: Log / Repeat / New Battle / End Gathering controls (`renderBattleControls`,
  `startResultsPolling`). Repeat re-seats the same decks (guests excluded from identities); New Battle clears decks
  only after the write succeeds and returns to the Gathering.
- `watch.ts`: watches the Gathering for a newly logged result (ignores pending writes and the previous Chronicle id)
  with the eight-second read fallback; tears down on context change.
- `state.ts`: pure grouping, edit permissions (Steward, participants, members on historical entries; never signed
  out), deck snapshots (full partner names, guest players, one-decimal Spark), feedback averages.
- `view.ts`, `dialogs.ts`: escaped templates. `chronicles.css`, prefix `chronicles-`.

Ports (`ChroniclesRuntime` + `BattleRuntime`, from `src/app/chronicles.ts`): `podId` (`app/active-pod`),
`requireAccount` (auth), `confirm`, `confirmDelete`, `confirmAction`, `battle` / `battleLogged` / `context` /
`setContext` / `clearDecks` (the current battle in `app/battle.ts`), `ready`, `analyze`, `colors`, `results`
(comparison), `openGathering` (Gatherings). `src/app/chronicles-auth.ts` refreshes the journal on every auth change;
`src/app/pods.ts` refreshes it on `pods:active`.

Events: none of its own (refreshes are driven by the app wiring above).

Data (Firestore, `src/services/cloud/chronicles.ts` and `gatherings.ts`; names exact):

- `pods/{podId}/chronicles/{autoId}`: `date`, `notes`, `decks` (up to `PM_LIMITS.chronicleDecks`), `createdAt`,
  `loggedBy`, `gatheringId`, `gatheringTitle`, `participants`, `feedbackResponses` (array of `{ uid, displayName,
fun, accuracy, bestMoment, submittedAt }`, added with `arrayUnion`), `notesEditedAt`, `notesEditedBy`.
- Logging also sets `lastLoggedChronicleId` and `lastLoggedAt` on `pods/{podId}/gatherings/{id}`; New Battle resets
  the seats' decks; End Gathering sets `status: "ended"` and `endedAt`.

No local storage.

## Testing

- Unit: `chronicles.test.ts` (snapshots, grouping, permissions, averages, logging order, escaping, delete/clear
  guards, pod-switch races, load failure, feedback writes and failures), `battle.test.ts` (repeat, new battle,
  confirmations, survey once per result, fallback reads, stale completions).
- e2e: `chronicles.spec.ts` (readable as a guest; clearing opens sign-in), `chronicles.modules.spec.ts` (Log Battle
  confirmation, host-only post-battle controls).
- By hand: in a pod with a live Gathering, Chart the Battle, Log Battle, then on another account answer "How was
  the battle?"; check the entry under Chronicles & Stories and add a note.

## Risks and rollback

Entries are shared history; a revert does not restore deleted or cleared entries. Roll back code with `git revert`.

## Follow-ups

None.

## Related

`004`, `014` (public profiles read Chronicles), `015` (active pod), `016` (Gatherings), `022` (comparison shows the
battle).
