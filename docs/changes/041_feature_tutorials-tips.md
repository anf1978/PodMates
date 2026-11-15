# 041: First-use tips for the deck tools (tutorials, phase 2)

Date: 2026-11-15

## Summary

Each deck tool now explains itself the first time someone uses it, in a short card at the bottom of the screen:
pasting a list, importing from Moxfield or Archidekt, Deck Crafter, scanning cards from a photo, Export, View
Deck, the card view, Load a Deck, signing in to save, and what happens after saving. Each tip shows once per
device. "Got it" closes it, and "No more tips" switches them all off; the **?** Help and tips button can turn
them back on or show them all again.

## What users see

| First time you…                                     | Tip                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| tap into the decklist box                           | **Paste a decklist**: one card per line; exports work; Commander can be left empty                     |
| tap into the deck link box                          | **Import a deck**: paste a Moxfield or Archidekt link, tap Load (outlined), Keep synced                |
| open Deck Crafter                                   | **Deck Crafter**: search and add; pick the commander first; the draft is kept on this device           |
| open Scan Cards                                     | **Scan cards**: add a photo, untick wrong names, add the rest                                          |
| open Export                                         | **Export**: copy the list in Moxfield or Archidekt format                                              |
| open View Deck                                      | **View Deck**: every card with art; tap one to see it larger                                           |
| open a single card                                  | **Card view**: any card name in PodMates opens like this                                               |
| open Load a Deck                                    | **Load a Deck**: your decks and podmates' shared ones                                                  |
| see the sign-in dialog (e.g. Save while signed out) | **Why an account?**: saved decks, pods and Deck Logs on any device; charting stays free                |
| save a deck                                         | **Saved**: Load a Deck (outlined) brings it back; Deck Log keeps its history; the lock keeps it secret |

A tip about a dialog shows on top of that dialog and goes away when the dialog closes. Tips wait while the
welcome card or the tour is on screen. Escape closes a tip.

## How it works

- `src/features/tutorials/tips.ts`: the tip list and `findTip()` (first unseen tip whose `when` element is on
  screen, whose `focus` field was focused, or whose `event` fired) and `tipGone()`. Dialogs are recognised by
  their existing headings or areas (`.db-heading`, `.scan-title`, `.export-title`, `.cv-title`,
  `#singleCardArtArea`, `#loadDeckListArea`, `.auth-title`), so no other feature changes for them.
- `src/features/tutorials/index.ts`: watches the page (debounced 50 ms), `focusin` and the new `decks:saved`
  event; shows one tip at a time; a tip about the open dialog lifts above it (`.tut-over`, z-index 1100).
- `src/features/saved-decks/save.ts` emits `decks:saved { name }` after a successful save; `events.ts` declares it.
- Data: the same device-only `pm_tips` (`seen` gains `tip-…` ids). No Firestore changes.

## Testing

- `src/features/tutorials/tips.test.ts`: focus tips once, the outlined target, dialog tips over their dialog and
  closed (as seen) with it, the save-event tip, No more tips, waiting during the welcome and tour, Escape, unique
  ids with one trigger each, skipping seen tips. `tutorials.test.ts` waits for the debounced watcher.
- `tests/e2e/tutorials.spec.ts`: on a fresh device, the paste tip shows on first focus, once.

## Risks and rollback

A tip could appear over a control someone wants; each closes with one tap or Escape, and "No more tips" stops
them. Revert with `git revert <sha>`.

## Follow-ups

- Phase 3: My Profile, MyPods, Gatherings, Chronicles, Impact cards, Spoiler Bait and the bell.

## Related

040 (tutorials phase 1), 012 (saved decks).

Later changes: 042
