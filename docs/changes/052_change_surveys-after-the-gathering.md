# 052: Rate battles after the Gathering, with a bell reminder

Date: 2026-11-27

## Summary

The "How was the battle?" survey used to pop up as soon as the host logged a battle, in the middle of game
night. Players don't want to stop and fill it in at the table. Now nothing pops up. Each player's
battles wait in a **Battles to rate** list in Chronicles, to answer whenever suits them. When the host ends the
Gathering, everyone who played gets a bell notice that their battles are ready to rate. The questions are unchanged.

## What users see

- **During a Gathering:** after **Log Battle** the host goes straight to "Battle logged. What's next?" and the
  other players see "Battle logged — thanks for playing! Rate it later under Battles to rate in Chronicles." No
  survey dialog opens.
- **Chronicles & Stories** (MyPods): a **Battles to rate (N)** box above the journal lists the battles you played
  in the last 30 days and haven't rated, newest first, with their commanders, Gathering and date. **Rate** opens
  the usual survey (Fun, Alignment accuracy, your deck against its Spark, Best moment). **Skip** takes the battle
  off the list. Once rated, a battle leaves the list on every device.
- **The bell:** when the host ends a Gathering, each podmate who played in one of its logged battles (and hasn't
  rated it yet) gets "<host> ended "<title>" — rate the battles you played", tagged **Rate**. Tapping it opens
  Battles to rate for that pod, even if another pod is active. It has its own switch under "What to tell me
  about" ("A battle you played is ready to rate"). As always, the host is not told about their own action, but
  their battles are on their own list too.
- In the survey, **Skip** now takes the battle off your list; **Close ×** leaves it there for later.
- A new first-use tip explains Battles to rate.

## How it works

- `src/features/chronicles/battle.ts`: the result watcher no longer opens the survey; `configureBattle()` drops
  its survey parameter. `index.ts` `runLogBattle()` refreshes the journal instead of opening the survey.
- `src/features/chronicles/state.ts`: `pendingSurveys()` (participant, no response by this uid, not skipped,
  within `SURVEY_WINDOW_MS` = 30 days), `surveyDeckFor()` (the player's own `deckRef` and Spark from the entry, for
  the Spark question), `battleLabel()`. `chronicleDeck()` also reads `uid` and `deckRef`.
- New `src/features/chronicles/surveys.ts`: the list templates (panel and dialog) and device-local skips in local
  storage `pm_survey_skipped_<uid>` (an array of Chronicle ids, last 200). Skipping writes nothing to Firestore.
- `index.ts`: `renderMatchLog()` renders the list above the journal; `openSurveys(podId, podName)` loads that pod's
  Chronicles and shows the dialog. `mount()` listens for the new `chronicles:surveys` event
  (`src/services/events.ts`). `showFeedbackSurvey()` gains optional `done`/`skipped` callbacks; `feedbackTemplate()`
  takes a separate Skip action.
- `src/services/cloud/gatherings.ts`: `endGathering()` then posts the notice in the background (not awaited;
  failures go to the error sink and never block ending). `surveyRecipients()` collects the uids in the
  participants of this Gathering's Chronicle entries, minus the person ending it and anyone who already rated
  every battle. One activity per 12 recipients (the rules' limit on `to`).
- `src/services/cloud/activity.ts`: `SURVEY_NOTICE_REF = "survey"`, `NOTICE_MAX_TO = 12`.
- `src/features/notifications/`: new `TYPES.survey`. `kindOf()` maps `gathering` + `ref: "survey"` to it (the live
  rules accept only the existing activity types, as with `deckUpdated` in `032`). Tapping it emits
  `chronicles:surveys`.
- `src/features/tutorials/tips.ts`: `tip-surveys` on `.chronicles-surveys-heading`. Styles in `chronicles.css`.
- Data: `pods/{podId}/activity/{autoId}` gains records with `type: "gathering"`, `ref: "survey"`, `to`: the players.
  Paths and field names are unchanged; feedback is still the same `feedbackResponses` write. **No rules changes**,
  so nothing needs pasting into the Firebase console.

## Testing

- `chronicles.test.ts`: Log Battle opens no survey; pending-list rules (rated, other players', skipped, older than
  30 days); the player's own deck for the Spark question; Rate saves and Skip hides without writing; the notice's
  event opens the list for its pod while another pod is active, and Skip in the survey empties it.
- `battle.test.ts`: a non-host sees the logged battle and no survey.
- `notifications.test.ts`: `gathering` + `ref: "survey"` is the survey kind and opens no Gathering; a forged
  `survey` type is ignored.
- New `src/services/cloud/survey-notice.test.ts`: recipients (only this Gathering, no host or guests, already-rated
  players left out); ending sends one addressed notice, splits 14 players into 12 + 2, and sends nothing when no
  battle was logged.
- `npm run check` locally.
- On the live site: host a Gathering with a second account, chart and **Log Battle** (no survey appears on either
  account), then **End Gathering**. The second account's bell shows the Rate notice. Tap it, then Rate or Skip.

## Risks and rollback

- An older cached page (before this deploy) would show the survey notice as "<host> invited the pod to a
  gathering", and tapping it finds no Gathering. This is harmless, and it stops once the page updates.
- A Gathering that is never ended sends no notice. The battles are still on each player's Battles to rate list.
- Skips are per device, so a skipped battle can show again on another device until it is 30 days old.
- Revert with `git revert <sha>`. Notices already sent stay in the activity feed (they expire from the bell
  after 30 days).

## Follow-ups

- Show the Battles to rate count on the collapsed Chronicles heading.
- A weekly digest-style reminder, if pods want one, once there is a way to send it.

## Related

`016` (Gatherings), `017` (Chronicles), `024` (notifications), `032` (stored-type mapping), `041`–`042` (tips),
`047` (Spark checks in the survey).
