# 044: Tips shown over a dialog no longer cover its buttons

Date: 2026-11-20

## Summary

On a phone, **Edit details** on a planned gathering seemed to do nothing. The first-use **Gathering** tip (042)
sits on top of the dialog at the bottom of the screen, and its card covered the Edit details row, so the tap
landed on the tip instead. Any tip shown over a dialog could cover that dialog's lower buttons the same way.

## What users see

- While a tip is on top of a dialog, the dialog shrinks to the space above (or below) the tip card, so every
  button in it can be reached. When the tip closes, the dialog goes back to its usual size.
- Edit details on a planned gathering opens its form and scrolls it into view (it opens below the buttons and
  could start off screen).

## How it works

- `src/features/tutorials/place.ts` `makeRoom()`: while a tip is about the open dialog (`.tut-over`), the
  `#tadOverlay` gets `.tut-room` (plus `.tut-room-top` when the card is at the top) and `--tut-room`, the card's
  height plus 12 px. `tutorials.css` turns that into overlay padding and caps the dialog's height at the space
  left. `index.ts` `syncOverlay()` calls it and clears it when the tip closes, the dialog changes or the
  tutorials unmount.
- `src/features/gatherings/waiting.ts`: the Edit details toggle scrolls the opened form into view.
- No data changes.

## Testing

`tutorials.test.ts`: a tip over a dialog gives the overlay its room and takes it back on Got it. Checked by hand
in a phone-sized Chromium with stand-in gathering data: before the fix the Edit details tap hit the tip card;
after it, the form opens.

## Risks and rollback

On a very short screen a tall tip leaves little room for the dialog; it scrolls inside the space left. Revert
with `git revert <sha>`.

## Follow-ups

None.

## Related

041, 042, 043 (tutorials).
