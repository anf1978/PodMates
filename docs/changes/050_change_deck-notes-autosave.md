# 050: Card notes and the primer save automatically

Date: 2026-11-22

## Summary

Tapping a chip in a card note didn't save until the owner scrolled down to **Save note**, and nothing warned
that closing would lose the change. Card notes and the Deck Primer now save on their own. A status line under
the title says so, and closing the note in any way saves anything still waiting.

## What users see

- Under the card name (or "Deck Primer"):
  - "Changes save automatically." until something changes;
  - then "Saving…" and "Saved." in gold;
  - if a save fails, "Couldn't save: …" with **Retry**, and the dialog stays open.
- A chip tap saves almost at once. Typing saves after a short pause (about a second), as does the primer. The
  "Share my notes" tick saves at once.
- **Save note** and **Save primer** become **Done**, and the primer's **Cancel** goes. Done, Close, Escape and
  tapping outside all save anything waiting before closing.
- Just opening a card's note writes nothing, so looking at PodMates' pre-filled chips doesn't create a note.
  **Delete note** shows whenever the card has a saved note.

## How it works

- New `src/features/deck-notes/autosave.ts` `createAutosaver()`:
  - saves a value after a delay unless another change comes first;
  - runs one write at a time, and the latest value wins;
  - `flush()` saves now on close; `cancel()` drops a waiting save before a delete.
- `index.ts`:
  - The note editor schedules a save on each chip tap (300 ms) and each edit to the text (900 ms).
  - The primer editor waits 1,200 ms after typing and saves the tick at once.
  - Both pass `onDismiss` so Escape and backdrop taps flush first.
- `view.ts`: `saveStatusTemplate()`; the editors take a save status instead of a busy flag and report input as
  it happens.
- No data or rules changes; each save is the same write as before.

## Testing

`deck-notes.test.ts` (fake timers):

- a chip tap saves after 300 ms;
- typing waits for the pause;
- Escape saves the latest text and closes;
- opening and closing without a change writes nothing;
- a failed save stays open with Retry, then saves;
- deleting a note;
- the primer saves its text and tick on Done.

Checked at phone size: "Saved." shows under the card name.

## Risks and rollback

More writes than before, at most one per pause, to the same document. Revert with `git revert <sha>`.

## Follow-ups

None.

## Related

047 (deck notes), 049 (pre-filled chips).
