# 043: Tutorial cards stay on the control they explain, and show its icon

Date: 2026-11-15

## Summary

During the tour the screen sometimes didn't move to the control being explained. Now it does, and the card
moves out of the way. Tips about icon-only buttons also show the actual icon next to its name, because on a
phone there's no hover to read a button's label. The tour gains a **Deck tools** step that lists every icon
next to Chart Deck with what it does.

## What users see

- Each tour step scrolls its control to the middle of the screen. If the page then scrolls somewhere else (such
  as the jump to new results after Chart Deck), it scrolls back.
- The Try a Deck and Chart Deck steps outline just that button, not the whole deck form.
- The card moves to the top of the screen when the control is in the lower half, so it never covers it. Focus
  tips (paste, import) keep the card off the field being typed in.
- Icons in the card: Try a Deck (tour step 1), View Deck, Export, Load a Deck, after saving (Load a Deck and the
  lock), and the bell.
- New tour step **Deck tools**, before the end: the button row is outlined and the card lists View Deck, Export,
  Try a Deck, Clear, Save, Keep secret and Load a Deck, each with its icon.

## How it works

- Cause: the tour scrolled once, then the Deck Chart's own smooth scroll to the results (and Try a Deck's nudge
  to Chart Deck) overrode it. The tour also outlined `closest(".panel")`, which for a button is the whole form.
- New `src/features/tutorials/place.ts`: `bringIntoView()` scrolls now and again after `SETTLE_MS` (450 ms) if
  the control has left the screen; `placeCard()` toggles `.tut-top`; `fillIcons()` copies each `[data-from]`
  control's SVG (id removed, `aria-hidden`) into the card, or its text when it has no SVG.
- `index.ts`: one `highlight()` for tour steps and tips; re-places the card on scroll; buttons, inputs, labels
  and links are outlined themselves, other targets their panel; `outlineParent` outlines a row.
- `state.ts` and `tips.ts`: optional `icons: { from, label }[]`; the new `tools` step. `view.ts` renders the
  icon list; `tutorials.css` adds `.tut-top` and `.tut-icons`.
- No data changes.

## Testing

`tutorials.test.ts`: button outline versus row outline, real icons copied (not moved), the re-scroll after the
page settles, the card at the top for a low control, and the new step in the order. `tips.test.ts`: the marker
check now also covers tour targets and every icon source. `tests/e2e/tutorials.spec.ts` still walks the whole
tour.

## Risks and rollback

On very short screens a tall panel can't fit beside the card; the panel is centred and the card sits at the
opposite edge. Revert with `git revert <sha>`.

## Follow-ups

None.

## Related

040, 041, 042 (tutorials).

Later changes: 044
