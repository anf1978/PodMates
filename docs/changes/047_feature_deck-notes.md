# 047: Deck notes and after-battle Spark checks

Date: 2026-11-21

## Summary

Deck crafters can now explain their decks. In **View Deck**, the owner of a saved deck can write a **Deck
Primer** for the whole deck and a **note on any card**: one-tap role chips plus a few words or paragraphs.
Podmates who can see the deck read them. After a battle, a player whose own saved deck was in it is also asked
whether the deck played **stronger, about right or weaker than its Spark**. The answers show in that deck's
Deck Log.

The owner can copy the decklist, primer, card notes and Spark answers as one block of text, ready to paste into
a calibration session. This is the first step of using crafters' knowledge to tune Spark. A later weekly
export is planned, using the opt-in tick box added here. No scores change.

The Firestore rules gain two sub-collections, which the owner must paste into the Firebase console.

## What users see

- **View Deck, owner of a saved deck**:
  - A header above the cards. The **Deck Primer** shows four lines, with **Read more** for longer primers.
  - **Write a primer** (or **Edit primer**) opens a roomy editor with the tick box **Share my notes and
    decklist to help tune Spark** (off by default).
  - **Copy deck, primer and notes** opens the text with a Copy button.
  - The hint "Tap (icon) on any card to say why it's in the deck."
  - A round note button in each card's lower-right corner: faint when empty, gold with a note.
  - Tapping the button opens the note editor:
    - role chips: Ramp, Draw, Removal, Protection, Win condition, Combo piece, Synergy;
    - a text box (up to 2,000 characters);
    - **Save note**, and **Delete note** for an existing note.
  - Notes on cards since removed from the deck are kept, under a folded **Notes on cards no longer in the
    deck (N)** list.
- **View Deck, podmate**: the primer, plus a gold note button on cards that have notes, which opens the note
  read-only. Cards without notes show no button.
- **A pasted, edited or sample list** (signed in): "Save this deck to add a primer and card notes." Signed out:
  nothing changes.
- **After a battle** ("How was the battle?"): if your own saved deck played, a new optional question appears:
  "How did _deck_ play against its Spark (6.4)?", with **Stronger**, **About right** and **Weaker**.
- **Deck Log**: a new row, **Against its Spark**, such as "3 about right · 1 stronger", once there are answers.
- A first-use tip, **Deck notes**, appears the first time an owner sees the notes header.

## How it works

- **Data**: all new, and no existing paths or fields change.
  - `users/{uid}/decks/{deckId}/notes/current` holds `primer`, `cards` (card name → `{ roles, text, at }`),
    `shareForTuning` and `updatedAt`. It is one document, read only when View Deck opens, so deck lists stay
    light.
  - `users/{uid}/decks/{deckId}/sparkChecks/{chronicleId}` holds `{ verdict, spark, at, podId }`, one per
    battle; answering again replaces it.
  - Limits in `PM_LIMITS`: `deckPrimer` 20,000 characters, `cardNote` 2,000, `cardNotes` 300 cards.
- **Rules**: owner-only writes. Reads follow the deck: the owner always, podmates unless the deck is secret.
  Notes must be the `current` document, with a primer of up to 20,000 characters, at most 300 card notes and a
  boolean `shareForTuning`. A Spark check's `verdict` must be `stronger`, `right` or `weaker`, with a `podId` of
  up to 80 characters. Tested in `firebase/rules.test.ts` and `firebase/limits.test.ts` (the server limits
  equal `PM_LIMITS` exactly).
- **Code**:
  - `src/services/cloud/deck-notes.ts`: load and save notes, primer and Spark checks. It tidies roles and text
    and caps the number of cards with notes.
  - New feature `src/features/deck-notes/`:
    - `deckNotesExtras(target)` supplies View Deck's header and per-card button;
    - `state.ts` holds the role labels, the removed-card notes and `notesBundle()` (the copied text);
    - `view.ts` holds the templates; editors open as stacked dialogs (`#tadNoteOverlay`).
  - `card-viewer`: `showDeckViewer(matched, commanders, extras?)` takes a `DeckViewExtras` slot (header,
    per-card content, redraw). Without extras it renders exactly as before.
  - `src/app/card-viewer.ts` passes the form's saved deck (`chartedDeck()`) and the signed-in user.
  - `chronicles`: `showFeedbackSurvey(podId, chronicleId, mine?)`, where `mine` defaults to
    `myBattleDeck()`, the player's own deck in the current battle (by `deckRef`). The answer is saved with
    `saveSparkCheck` before the battle ratings.
  - `deck-log`: `loadDeckLog()` adds a `sparkChecks` tally, and the panel shows it.
- Deleting a saved deck leaves its notes, like its change log. Saving a deck under the same name later brings
  them back.

## Testing

- `src/services/cloud/deck-notes.test.ts`: save, replace, remove, caps, owner-only, and Spark checks.
- `src/features/deck-notes/deck-notes.test.ts`: the owner adds a note with roles; primer and tuning choice;
  podmates read-only; unsaved and signed-out decks; removed-card notes; the exact copied text.
- `chronicles.test.ts`: the question only for your own deck, and its saved answer.
- `deck-log.test.ts`: the new row.
- Rules: `npm run test:rules` passes, 218 tests.
- Checked by hand at phone size with stand-in data: the header, the editor, the copy dialog.

## Risks and rollback

Until the new rules are published in the Firebase console, saving a note fails with a
permission error (shown in the editor). Reading also fails quietly, so the notes header doesn't show. A
refused Spark answer is reported and skipped; the battle's ratings still save. Revert with `git revert <sha>`.

## Follow-ups

- Step 3 of the plan: a weekly export of notes whose owners ticked **Share my notes**, together with their
  decklists and Spark answers, for a calibration review.

## Related

011 (View Deck), 017 (Chronicles), 038 (Deck Log), 040–042 (tips).

Later changes: 048, 049
