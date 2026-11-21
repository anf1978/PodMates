# 045: Scan Cards fits on one screen

Date: 2026-11-21

## Summary

On a phone, the Scan Cards dialog opened with a long block of instructions, so you had to scroll down to reach
Add a Photo, and scroll again to reach the results and the Add button. It now fits one screen with no scrolling.

## What users see

- The photo buttons sit at the top, right under the title, with a one-line note: names only, not quantities,
  and ticked cards go to Deck Crafter. Add a Photo is the main button.
- The instructions fold into **Tips for a good photo**, which opens on tap (the same tips, a little shorter).
- The found cards scroll in their own box, and **Add Checked Cards to Deck Crafter** stays at the bottom of
  the dialog, full width.
- The "Done" line is shorter: "Done — found N new card(s) in N photo(s). Untick any that are wrong."

## How it works

- `src/features/scan-cards/view.ts`: new order (header with title and Close, note, photo buttons, `<details>`
  tips, status, results, action row). Every id is unchanged.
- `index.ts`: the dialog opens with `modalClass: "tad-modal scan-modal"`; shorter status text.
- `scan-cards.css`: `.scan-modal` is a flex column capped by the usual dialog height; only
  `#scanCardsResultsArea` grows and scrolls; open tips cap at 34vh.
- No data changes.

## Testing

Unit and e2e scan tests unchanged and passing (ids and the "found N new card(s)" text are kept). Checked by
hand in Chromium at iPhone 13, iPhone SE and Pixel 7 sizes with 22 found cards: the dialog and page don't
scroll, the Add button is on screen, and the list scrolls inside its box, with the tips open or closed.

## Risks and rollback

On a very short screen with the tips open, the results box gets small; closing the tips gives the room back.
Revert with `git revert <sha>`.

## Follow-ups

None.

## Related

009 (Scan Cards), 041 (its first-use tip).
