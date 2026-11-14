# 038: Deck Log

Date: 2026-11-14

## Summary

A new **Deck Log** panel under Structure & Legality shows a saved deck's history: when it was first saved, how
often its owner has charted it and how often podmates have looked at it, who charted it last, how many battles
it has played, how many it has won, and every change to its cards with Spark before and after. The owner can add
or undo a win and add a short note to each change. Podmates see a shared deck's log but can't change it. One
part needs the owner to paste updated Firestore rules into the Firebase console: podmates' view counts and the
change log.

## What users see

- **Deck Log** panel (collapsed, like the others), directly under Structure & Legality, after any chart.
  - A saved deck (opened from Load a Deck, just saved, or charted from a pod profile or a deck notice): its name
    and a grid with **First Charted** (the first save; "Before Deck Logs" for decks saved earlier), **Charted by
    you** (or **Charted by its owner** for podmates), **Viewed by podmates**, **Last charted** ("2 h ago by
    Bo"), **Battles** (with "(N approximate)" for older battles), **Wins** (plus the win rate from 3 battles).
  - Owner only: **+1 Win** and **Undo win** (never below zero).
  - **Change Log (N)**: one collapsed entry per save that changed cards, headed with the date and "+3 −2 · Spark
    5.2 → 5.6". Opening it lists **Added** cards as solid chips and **Removed** cards as dashed chips (the Key
    Pieces & Combos styles), then the note. The owner gets **Add a note** / **Edit note**.
  - A pasted, edited, sample or crafted list: "Deck Log follows saved decks…". Signed out: "Sign in and save this
    deck…".
- Typing into the decklist or commander after loading a deck makes it a different deck: it no longer counts as
  that saved deck.

## How it works

- Data (new fields only; existing paths and fields unchanged):
  - `users/{uid}/decks/{deckId}` gains `firstSavedAt` (set on a deck's first save), `chartCount`, `podViewCount`,
    `lastChartedAt`, `lastChartedBy`, `wins`. `saveDeck` now writes with `merge: true` so re-saves keep them.
  - New sub-collection `users/{uid}/decks/{deckId}/changes/{autoId}`:
    `{ at, added: ["1 Sol Ring"…], removed, sparkBefore, sparkAfter, note? }`. Written by `saveDeck` when the card
    list changes (not for backup restores or mirror repairs). The newest 50 are kept; at most 300 lines per side;
    note at most 280 characters (`PM_LIMITS.deckChange*`).
  - Gathering seats picked from saved decks store `deck.deckRef: { uid, id }`; Chronicles battle entries copy it
    into each deck (`decks[].deckRef`).
- `src/services/cloud/deck-log.ts`: `recordDeckChart` (owner → `chartCount`, podmate → `podViewCount`, both set
  `lastChartedAt`/`lastChartedBy`; secret decks never count podmates), `changeDeckWins` (owner only),
  `setDeckChangeNote` (owner only), `recordDeckChange`, `diffCards`, `countBattles`, `loadDeckLog`, and
  `configureDeckLog({ sparkOf })`, which `src/app/deck-log.ts` wires to `analyzeOneList`. Counters are read and
  written as the current value + 1, which the rules require for podmates.
- `src/services/deck-form.ts`: `chartedDeck()` / `setChartedDeck()`. `fillDeckForm` clears it; Load a Deck,
  Save (`saved-decks`), the pod-profile and deck-preview chart (`app/profile.ts`, `_docId` on profile analyses)
  set it; Clear and typing in the list or commander clear it (`deck-form`).
- `src/features/deck-chart/run-analysis.ts` emits the new `chart:done` event; `src/features/deck-log/` listens,
  counts, loads and renders (stale loads ignored).
- `index.html`: `#deckLogPanel` after `#legalityPanel`; `deck-log.css` linked and in the Vite stylesheet list;
  `src/main.ts` imports `app/deck-log.ts` after `app/deck-chart.ts`.
- **Rules** (`firebase/firestore.rules`): a podmate may update a shared deck only by changing `podViewCount` to
  exactly its current value + 1 plus `lastChartedAt` (number) and `lastChartedBy` (≤ 80 characters); the owner's
  write rule also caps `lastChartedBy`. New `changes` match: read like the deck (owner, or shared-pod podmates
  when not secret), create/update/delete by the owner with list and note guards. A new `sharesPodWith()` helper.

## Testing

- `src/services/cloud/deck-log.test.ts`: card diffs; first-save stamp kept across saves; counters survive
  re-saves; change entries with Spark; unchanged lists and restores add none; only the newest 50 kept; owner and
  podmate chart counts; no podmate count on secret decks; owner-only wins (never below zero); notes; log loading;
  battle counting (exact, approximate, other decks, partners in any order).
- `src/features/deck-log/deck-log.test.ts`: the panel's grid, collapsed change entries with solid/dashed chips and
  escaped names, signed-out and unsaved messages, missing decks, wins, podmate view, note editing, stale loads.
- `src/services/deck-form-charted.test.ts`, `src/features/chronicles/deck-ref.test.ts`; existing gathering,
  saved-deck and repository tests updated (merge save, `firstSavedAt`).
- `firebase/rules.test.ts` → `deck log` (run locally with the emulator: 209 rules tests pass).
- By hand after the rules are pasted in: save a deck, change a card, save again, chart it. The Deck Log shows 1
  change with Spark before and after; a podmate charting it from Load a Deck raises "Viewed by podmates".

## Risks and rollback

- Until the rules are pasted in, podmates' views are refused and change entries can't be written or read. Both
  fail quietly; owners' counts, wins and first-save dates work.
- Renaming a deck saves it under a new document, so its log starts again.
- Two charts at the same moment can lose one count (read, then write + 1).
- Revert with `git revert <sha>`. The added fields and change entries stay in Firestore, unused; reverting the
  rules in the console is optional.

## Follow-ups

- Paste the updated rules into the Firebase console and record the date in `firebase/console-settings.md`.
- Optional: mark a winner in Log Battle so wins can be counted automatically.

## Related

005 (Deck Chart), 006 (deck form), 012 (saved decks), 014 (profile), 016 (Gatherings), 017 (Chronicles), 029–030
(Firebase records).
