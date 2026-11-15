# 040: Welcome card and first-chart tour (tutorials, phase 1)

Date: 2026-11-15

## Summary

New visitors now get a short welcome that offers to chart a real Commander precon and then walks through the
results, one panel at a time. Visitors pick the precon themselves, and the tour waits for them at each step, so
it never navigates anywhere on their behalf. They can skip it, put it off until their next visit, or replay it
later from a new **?** Help and tips button. This is the first phase of the tutorials. Tips for getting decks in,
saving, My Profile and MyPods come next.

## What users see

- **First visit on a device:** a card at the bottom of the screen, "Welcome to PodMates", with **Show me**,
  **Later** (shows again next visit) and **No thanks**. Escape is the same as Later.
- **The tour** (Show me):
  1. "Pick a deck": the Try a Deck button is outlined. The visitor chooses any precon; closing Try a Deck
     without choosing just leaves the step waiting.
  2. "Chart it": the Chart Deck button is outlined.
  3. After the chart, **Next** steps through the radar, Command Spark, Bracket, Closest match, Key pieces and
     combos, Structure and legality and Deck Log, each outlined and scrolled into view. Panels the deck doesn't
     have are skipped.
  4. "That's the tour" points to pasting, importing and Deck Crafter, and to the **?** button.
     Every waiting step offers **Later** and **Skip tour**; charting their own deck instead jumps straight to the
     results steps.
- **?** (Help and tips) in the account bar: **Take the tour**, **Turn tips off/on**, **Show all tips again**.
- The card hides while any dialog is open and comes back when it closes.

## How it works

- New feature `src/features/tutorials/`: `state.ts` (tour steps, stored state), `view.ts` (card, ? button, menu),
  `index.ts` (welcome, tour engine, overlay watch, Escape), `tutorials.css` (linked in `index.html` and listed in
  `vite.config.js`). `src/main.ts` mounts it on `#authBar` after notifications.
- Events: new `samples:chosen { key }`, emitted by `src/app/try-a-deck.ts` when a sample is loaded into the
  form; the tour also listens to `chart:done`.
- Data: device only. Local storage `pm_tips` = `{ seen: string[], off: boolean }` (`welcome` and
  `tour-first-chart` so far); session storage `pm_tips_later` for Later. No Firestore changes. `reportError`
  gains the `tutorials` operation.
- `playwright.config.ts`: every test browser starts with tips off, so the card never covers controls in other
  specs.

## Testing

- `src/features/tutorials/tutorials.test.ts`: welcome (first visit, Later for this visit only, No thanks
  remembered, Escape, hidden behind dialogs), the full tour (waiting steps, highlight moves, skipped panel, exact
  step order, Done stored), jumping to the results after charting a pasted deck, Later and Skip mid-tour, step
  numbering, Help and tips (toggle, reset, replay), damaged storage.
- `tests/e2e/tutorials.spec.ts` (fresh storage): the welcome card passes axe; Show me; Try a Deck hides the card;
  pick Uril; Chart; Next to the end; Done; reload shows no welcome; Later then replay from Help and tips.
- By hand: open the site in a private window. The welcome card appears; tap Show me and follow it through.

## Risks and rollback

The fixed card covers the bottom of the screen while it's open; every step can be closed. Revert with
`git revert <sha>`; stored `pm_tips` values are then ignored.

## Follow-ups

- Phase 2: first-use tips for paste, import from Moxfield or Archidekt, Deck Crafter, scanning and saving
  (signed-out Save explains accounts; after the first save, Load a Deck and Deck Log).
- Phase 3: My Profile, MyPods, Gatherings, Chronicles, Impact cards, Spoiler Bait and the bell.

## Related

007 (Try a Deck), 005 (Deck Chart), 024 (notifications, same account-bar slot), 038 (Deck Log).

Later changes: 041
