# 053: Battles to rate show up for the host, and on MyPods

Date: 2026-11-27

## Summary

After `052`, a host who ended their games saw no survey and no notification. There were two reasons. The bell never
tells you about your own actions, so the person who ends a Gathering got no notice. And the Battles to rate
list sat inside the collapsed Chronicles & Stories panel, so it was easy to miss. Now, ending a Gathering opens
your Battles to rate straight away (the night is over). The list sits at the top of the Chronicles panel on
MyPods, not inside the collapsed part. The bell also keeps a standing "You have N battles to rate" reminder
for everyone, host included, until they are rated or skipped.

## What users see

- **End Gathering** (from the battle results or from the Gathering dialog): if you played in any of its battles
  and haven't rated them, the Battles to rate dialog opens at once, titled with the Gathering. Nothing opens
  when there is nothing to rate.
- **MyPods:** the Battles to rate box shows above **Chronicles & Stories** without opening it.
- **The bell:** a "You have 2 battles to rate" item (tag **Rate**) for your active pod. Tapping it opens the list.
  It goes away once everything is rated or skipped. It has its own switch, "I still have battles to rate". The
  notice to other players when a Gathering ends (`052`) is unchanged.

## How it works

- `src/features/chronicles/view.ts`: `#chroniclesSurveysArea` before the panel's `<details>`.
  `index.ts` `renderMatchLog()` renders the list there and the journal in `#matchLogArea`. Each render emits
  `chronicles:pending` `{ uid, podId, count, latestAt }`.
- `chronicles:surveys` now carries `{ podId, heading, onlyIfPending? }` (`src/services/events.ts`). Both End
  Gathering paths (`chronicles/battle.ts` and `gatherings/view.ts`) emit it with `onlyIfPending: true` after the
  write succeeds. `openSurveys()` returns without a dialog when that is set and nothing is pending.
- `src/features/notifications/`: new device-built kind `toRate` (`toRateItem()` in `state.ts`), held in a map in
  `index.ts` that survives inbox restarts and is filtered to the signed-in account. Muting the pod or switching the
  kind off hides it. A stored activity can't claim this kind.
- No data or rules changes.

## Testing

- `chronicles.test.ts`: the list renders outside the collapsed `<details>` and reports its count (and 0 after
  Skip); after End Gathering, an empty list opens nothing.
- `notifications.test.ts`: the reminder's text, muting, its switch, and a forged `toRate` activity being ignored.
- `npm run check`.
- On the live site: as the host, log a battle, then **End Gathering**. Battles to rate should open. Close it and
  check the bell ("You have 1 battle to rate") and the box above Chronicles & Stories on MyPods.

## Risks and rollback

The bell reminder only covers the pod currently active on MyPods. The other pods still get the end-of-Gathering
notice. Revert with `git revert <sha>`.

## Follow-ups

Reminders for every pod, not only the active one.

## Related

`052` (rate battles after the Gathering), `024` (notifications), `017` (Chronicles).
