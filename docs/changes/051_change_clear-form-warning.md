# 051: Clear moves to the end of the deck tools and asks before losing an unsaved deck

Date: 2026-11-22

## Summary

The eraser (**Clear form**) sat in the middle of the deck tools, between Try a Deck and Save, where it was
easy to tap by mistake. It now comes last, so on a phone it sits on the bottom row. Clearing a deck that hasn't
been saved now asks first.

## What users see

- Deck tools order: View Deck, Export, Try a Deck, Save Deck, Keep secret, Load a Deck, **Clear form**.
- On phone widths (iPhone 13, iPhone SE, Pixel 7) Clear is on the bottom row.
- Clear with an unsaved deck in the form asks: "This deck hasn't been saved. Clear it anyway? It can't be
  brought back." The buttons are **Keep it** and **Clear anyway**.
- An unsaved deck is a pasted, imported, crafted or scanned list, or a saved deck or precon you have edited.
- No question for an empty form, a saved deck as loaded or just saved, or an untouched Try a Deck precon (it
  can be picked again).
- The tour's **Deck tools** step lists Clear last: "Clear the form (asks first if the deck isn't saved)".

## How it works

- `index.html`: `#clearBtn` moves after `#loadDeckBtn` in the same row. No other markup changes.
- `src/services/deck-form.ts`:
  - New `sampleInForm()` / `setSampleInForm()`. `src/app/try-a-deck.ts` sets it after filling the form with
    a precon.
  - `fillDeckForm()`, typing in the list or commander, and Clear reset it.
- `src/features/deck-form/index.ts`:
  - `requestClear()` clears at once unless `unsavedDeckInForm()`: there is a decklist, `chartedDeck()` is
    empty and no untouched precon is loaded. Otherwise it shows `showActionConfirmModal`.
  - Importing a deck link now also resets `chartedDeck()` and the precon flag. Before, an imported list could
    still count as the saved deck loaded earlier, which also affected the Deck Log.
- `src/features/tutorials/state.ts`: the Deck tools icon list follows the new order.

## Testing

- `src/features/deck-form/deck-form.test.ts`:
  - Clear without a question for an empty form, a saved deck and an untouched precon;
  - the question, with Keep it and Clear anyway;
  - an edited saved deck or precon counting as unsaved.
- Measured in Chromium at phone sizes: Clear is on the bottom row.

## Risks and rollback

One more tap to clear an unsaved deck. Revert with `git revert <sha>`.

## Follow-ups

None.

## Related

006 (deck form), 038 (Deck Log), 043 (Deck tools tour step).
