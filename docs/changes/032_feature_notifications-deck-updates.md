# 032: Notify the pod when a podmate updates a deck

Date: 2026-11-13

## Summary

The bell already told you when a podmate saved a new deck. Now it also tells you when they change the cards in a
deck they've already shared. Only real changes count: re-saving the same list, renaming a deck or making it
secret stays quiet. Decks linked from Archidekt or Moxfield update themselves when they sync, so those send at
most one notice per deck per day. Secret decks never send notices.

## What users see

- A new bell row: **"Ann updated a deck: Atraxa (Ann)"**, tagged "Deck", which opens the pod like other deck
  notices.
- A new switch in the bell's settings: **"A podmate updates a deck"** (on by default; per device, like the others).
- Nothing changes for the person saving.
- A page still running the previous version (an open tab or cached install) shows such a notice as "charted a new
  deck" until it updates.

## How it works

- `src/services/cloud/decks.ts` `saveDeck(key, entry, docIdOverride?, { updateNotice })`: it now reads the stored
  deck (the same single read that used to check existence) to get its old list. New decks behave as before. For an
  overwrite of a non-secret deck it asks `shouldAnnounceUpdate()` and, if yes, logs a `deck` activity with
  `ref: "updated"` to each of the owner's pods. If the read fails, the deck still counts as existing (the cap is not
  applied, as before) and no update notice is sent.
- New `src/services/cloud/deck-update-notice.ts`: `cardListKey()` compares lists ignoring order, blank lines,
  spacing and case. `updateNotice` is `"now"` (default: hand saves from the save dialog and Deck Crafter),
  `"daily"` (linked-deck add/refresh in `linked-decks.ts`) or `false` (My Data restore in `services/saved-decks.ts`
  and the mirror repair in `features/profile/decks.ts`). The daily limit is per account and deck, remembered on
  that device in local storage `pm_deck_update_notice_<uid>` (`{ deckDocId: timestamp }`, pruned after 24 h).
  Storage failures allow the notice.
- `src/features/notifications/state.ts`: new `TYPES.deckUpdated`. `kindOf()` maps `deck` + `ref: "updated"` to
  it (and ignores a stored `deckUpdated` type). `visible()` filters on that kind, so the switch and the existing
  "new deck" switch are independent.
- Data: **no Firestore rule, path or field changes.** It reuses the `deck` activity type and the existing optional
  `ref` field (the live rules only accept the existing types, and sessions never deploy rules). New local storage
  key above.

## Testing

- `src/services/cloud/deck-update-notice.test.ts`: list comparison, the daily limit (per deck, per account, expiry,
  corrupt storage), and `saveDeck` end to end with the fake Firestore (new deck, unchanged list, rename, real
  change, secret, `false`, daily throttle, failed read).
- `src/features/notifications/notifications.test.ts`: the new kind, its text, routing and both switches.
- `src/services/saved-decks.test.ts`: restore passes `updateNotice: false`.
- By hand after deploy: with two accounts in one pod, have A change a card in a shared deck and save. B's bell
  shows "A updated a deck: …". Saving again without changes adds nothing.

## Risks and rollback

If list comparison ever misfires, the worst case is an extra or missing bell row. At most one notice per save, and
syncs are capped daily. Saving a deck now reads its full document instead of only checking it exists (same one
read). Roll back with `git revert <sha>`; notices already written stay in the feeds and old pages show them as
"charted a new deck".

## Follow-ups

- The daily limit is per device, so the same deck syncing on two devices could notify twice in a day.

## Related

024 (notifications), 012 (saved decks), 014 (profile: linked decks), 029–030 (rules and console settings).
