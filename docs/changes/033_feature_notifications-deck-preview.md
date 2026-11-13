# 033: Deck notices open a preview of the deck, with "Chart this deck"

Date: 2026-11-13

## Summary

Tapping a "charted a new deck" or "updated a deck" notice used to open the pod page, so you had to go looking
for the deck. Now it opens a preview of that deck: who built it, the commander and its artwork, the Command Spark,
bracket, style, card count and the five profile scores. A **Chart this deck** button loads it onto the Deck Chart
for the full analysis.

## What users see

- Bell → tap a deck notice (new or updated) → a **deck preview** overlay with the deck name, "by <player>", commander
  art and name, a stats grid (Command Spark, Bracket, Style, Cards) and the five scores (Speed, Consistency,
  Versatility, Disruption, Power Level).
- **Chart this deck** closes the preview and charts the deck the same way charting from a pod profile does (Deck
  Chart tab, deck form filled with the podmate's list and commander). **Close** just closes it.
- If the deck can't be shown (renamed, deleted or made secret since the notice), the preview says so and offers
  **See <player>'s profile**. While the card database is still loading, it asks you to try again in a moment.
- Other notices still route as before (gatherings open the gathering, the rest open the pod).

## How it works

- `src/features/notifications/index.ts` `openItem`: `deck` and `deckUpdated` items emit `decks:preview`
  `{ uid: by, name: byName, podId, deckName: subject }` instead of `pods:open`.
- `src/services/events.ts`: new `decks:preview` event.
- New `src/features/profile/deck-preview.ts` (listened to in `profile/index.ts`): finds the deck with the new
  `findPodmateDeck(uid, name)` in `src/services/cloud/decks.ts`. That is the same `secret == false` query the pod
  profiles use, matched on deck name or key, with the 160-character subject cut-off handled. It analyses the deck
  with the existing public-profile runtime (`analyzeOneList`, same scores as everywhere else), fetches the
  commander art and renders with lit. "Chart this deck" uses the runtime's existing `chartDeck`.
  `PublicProfileAnalysis` gains the optional fields the preview reads (all five scores, `commandSpark`,
  `totalCards`, `bracket.bracket`).
- Styles: `pp-deck-stats` and `pp-deck-axes` in `public-profile.css` (token colours).
- Data: no Firestore path, field or rule changes. Reads only decks the rules already let podmates read. Older
  notices work too, because they carry the deck's name.

## Testing

- `src/features/profile/deck-preview.test.ts`: stats grid and scores, Chart button hand-off with the raw
  list and commander, a deck no longer shared (profile fallback), database still loading, load failure.
- `src/services/cloud/podmate-deck.test.ts`: lookup by deck name, by key, by a truncated subject; secret, missing
  and denied reads give null.
- `src/features/notifications/lifecycle.test.ts`: new and updated deck notices emit `decks:preview` (not
  `pods:open`); the pod-routing case now uses a "joined" notice.
- By hand after deploy: with two accounts in a pod, A saves or updates a shared deck. B opens the bell, taps the
  notice, sees the preview, taps **Chart this deck**, and the Deck Chart shows A's deck.

## Risks and rollback

If two of a player's shared decks have the same display name, the preview shows the first one Firestore returns.
Roll back with `git revert <sha>`; deck notices then open the pod again.

## Follow-ups

- Notices could carry the deck's document id to make the lookup exact, but `ref` is already used as the
  "updated" marker and the rules allow no new fields.

## Related

024 (notifications), 014 (profile), 032 (deck update notices).
