# 016: Gatherings (game nights and live tables)

Date: 2026-11-12

## Summary

A Gathering is one game night for a pod. The host picks who sits where (podmates or named guests, up to six
seats), either sends invites and waits for replies or starts at once, and everyone loads a deck into their seat.
Then the host charts the battle: the table's decks are compared side by side (`023`), and the result can be logged
to the pod's Chronicles (`017`). Anyone can also try a **sample table** of six library decks without an account.

## What users see

- **Host a Gathering** (pod detail, `015`): title, date, time, place; seat pickers for members or guest names;
  **Save Lineup** (reusable lineups shared with the pod); **Send invites & wait for replies** or **Start now
  (everyone is already here)**. Then "Invites sent" (or an honest "not confirmed" message if delivery is unknown) with
  **Open** / **Done**.
- **Landing cards** on MyPods for proposed and live Gatherings, with RSVP; stale invites drop off (proposed only:
  two days after the planned date, or seven days after creation without a date). Declined invites are hidden.
- **Waiting tray** (proposed): who accepted, declined or has not replied; your own reply; host edits, reminders and
  the switch to live; **Cancel**.
- **Live tray**: the six seats with deck pickers (your saved decks or podmates' via Load a Deck, `012`), guest seat
  controls, **Chart the Battle** (host only; others see "Waiting for … to chart the battle"), **Refresh** and **End
  Gathering** (host, with a warning that live updates never overwrite).
- **Sample a Gathering** (MyPods landing): "Sample table" loads six library decks and charts them, no battle logged.

## How it works

- `index.ts`: `mount()` subscribes to `gatherings:open`, `gatherings:host`, `gatherings:sample` and
  `gatherings:paint`; the cleanup also stops polling. Also exports `openLiveGatheringOverlay`,
  `renderLiveGatheringTray`, `gatheringRsvp`, etc.
- `host.ts` (setup and lineups), `waiting.ts` (proposed tray), `view.ts` (overlay lifecycle, live seats, chart
  handoff, sample table), `tray.ts` + `controls.ts` (shared seat controls and RSVP writes), `landing.ts` (MyPods
  cards), `watch.ts` (one realtime listener with an 8-second polling fallback; closing or replacing a tray stops it).
- `state.ts`: pure seat collection, lineup restore (current members and named guests only), RSVP defaults (a
  missing legacy RSVP means accepted), stale rules, signatures.
- `gatherings.css`, prefix `g-`.

Ports (`GatheringRuntime`, `runtime.ts`, from `src/app/gatherings.ts`): `ready`, `library` (lazy deck library),
`analyze` (`app/analysis`), `colors` (`POD_COLORS`), `results` (sets the battle context in `app/battle.ts`, shows the
comparison, renders Chronicles' battle controls and starts its results polling), `refreshPods` (emits
`pods:refresh`), `confirm`, `pickDeck` (emits `decks:pick`).

Events: listens to `gatherings:open`, `gatherings:host`, `gatherings:sample`, `gatherings:paint`; emits (via ports)
`pods:refresh` and `decks:pick`.

Data (Firestore, `src/services/cloud/gatherings.ts`, `table-formations.ts`; names exact):

- `pods/{podId}/gatherings/{autoId}`: `title`, `hostUid`, `status` (`setup` / `proposed` / `live` / `ended` /
  `cancelled`), `seats` (a map keyed `"0"`–`"5"`, each `{ uid, displayName, deck, rsvp?, guest? }`, written by field
  path `seats.N` so two seats never clobber each other), `createdAt`, `updatedAt`, `goLiveAt`, `whenDate`,
  `whenTime`, `place`, `chartedAt`, `lastLoggedChronicleId`, `lastLoggedAt`, `endedAt`, `cancelledAt`.
- `pods/{podId}/tableFormations/{name}`: `seats` (up to 6), `savedAt`, `savedBy`, `updatedAt`.
- Going live logs a `live` activity. Limits: `PM_LIMITS.gatheringTitle`, `displayName`.

No local storage.

## Testing

- Unit: `gatherings.test.ts` (seat collection, lineup restore, stale rules), `lifecycle.test.ts` (hosting with
  guests, unconfirmed delivery, safe RSVP, guest decks not Chronicle participants, end warning, tray teardown,
  guest controls, stale fetches, sample cancel, landing filters), `watch.test.ts` (fallback and cleanup).
- e2e: `gatherings.modules.spec.ts` (sample cancels a closed loading dialog and hands six decks over; library loads on
  demand). Authenticated flows are repository-mocked only.
- By hand: on MyPods press Sample a Gathering. With two accounts in a pod: host, invite, accept on the other
  account, go live, load decks, Chart the Battle, End Gathering.

## Risks and rollback

Gathering documents are live shared state; a bad write shows to the whole pod at once. Never change paths or
fields. Roll back code with `git revert`.

## Follow-ups

- `view.ts` still describes itself as "handoff to the legacy chart"; the chart is the typed comparison feature now
  (stale comment).
- `src/app/gatherings.ts` casts the library and analysis types (`as unknown as`): the shared-model gap in
  `docs/architecture.md`.

## Related

`004`, `012` (seat deck picker), `015` (pods emit host/sample/paint), `017` (battle logging and results), `023`
(comparison), `024` (notifications open Gatherings).
