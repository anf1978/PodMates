# 036: Bell notice when a deck is added to Try a Deck

Date: 2026-11-13

## Summary

When a new deck (usually a new precon) is added to Try a Deck, signed-in players now see it in the bell: **"New in
Try a Deck: Federation Fleet (Kirk, Starfleet Captain)"**. Tapping it opens the same deck preview as podmates' decks
(commander art, Command Spark, bracket, style, card count, five scores) with **Chart this deck**. Notices last 30
days and have their own on/off switch.

## What users see

- A bell row tagged **New deck**, with "Try a Deck" where other rows show the pod name.
- Tapping it opens the preview, titled with the deck's name and its Try-a-Deck tagline; **Chart this deck** loads
  it onto the Deck Chart (as choosing it in Try a Deck does) and charts it.
- A new settings switch, **"A deck is added to Try a Deck"** (on by default, per device).
- Signed-in accounts only, like every other notice. Signed-out visitors have no "seen" time, so the same decks
  would look new on every visit.
- Nothing shows yet: only decks with an `addedAt` date count, and the precon importer (037) is what stamps it.
  Decks added before then don't produce notices.

## How it works

- Data: Try-a-Deck entries may carry `addedAt` (a `YYYY-MM-DD` date). `TRY_A_DECK_METADATA` keeps it, since it
  copies every field but the decklist. No Firestore writes: these notices are built on each device and never stored
  in pods' activity feeds.
- `src/services/card-data.ts`: `loadNewSampleDecks(now)` reads the deck metadata (the same cached file the first
  chart loads), keeps decks added in the last 30 days (`recentlyAdded()`) that this card database can offer
  (`availableSampleDecks`), newest first.
- `src/features/notifications`: new kind `tryADeck` (`TYPES`, `sampleItem()`, `state.library`). `visible()` adds
  these after the pod feeds; pod mutes don't apply, the kind's switch does, and a stored activity of that type is
  ignored. `restart()` loads them for signed-in accounts. Tapping emits the new `samples:preview { key }` event.
  The row meta says "Try a Deck".
- `src/features/profile/deck-preview.ts`: now one preview with two loaders. `openDeckPreviewOverlay` (podmates, 033) and the new `openSamplePreviewOverlay` (Try-a-Deck library via `loadDeckLibrary()`; title is the deck's
  name, byline its tagline). "Chart this deck" uses the profile runtime's existing `chartDeck`.

## Testing

- `src/features/notifications/notifications.test.ts`: library items show with their own switch, ignore pod mutes,
  expire after 30 days; a forged `tryADeck` activity is ignored.
- `src/features/notifications/lifecycle.test.ts`: a new deck shows with an unread badge and escaped text, and
  routes to `samples:preview`; signed-out visitors get nothing. The deck-list loader is faked, so there's no
  network.
- `src/features/profile/deck-preview.test.ts`: the Try-a-Deck preview (title, tagline, Chart hand-off) and a
  missing deck.
- `src/services/new-sample-decks.test.ts`: the date window (undated, malformed and future dates excluded).
- By hand: after the first importer pull request merges and deploys, a signed-in account sees the new decks in
  the bell; tap one, then **Chart this deck**.

## Risks and rollback

Signed-in accounts now fetch the deck metadata (~74 KB, cached) shortly after start-up instead of on their first
chart. Signed-out first loads are unchanged (the lazy-data e2e test still checks this). Revert with
`git revert <sha>`.

## Follow-ups

None.

## Related

024, 033 (notifications and deck preview), 007 (Try a Deck), 037 (precon importer).

Later changes: 037
