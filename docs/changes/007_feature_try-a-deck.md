# 007: Try a Deck, the sample deck library

Date: 2026-11-12

## Summary

Try a Deck lets someone who has no decklist to hand pick one of the site's 178 sample decks: official Commander
precons since 2011 and curated lists. You browse by strategy (archetype), by release year and set, or by exact
colour style, and the chosen deck drops into the deck form ready to chart. It is the quickest way to see what
PodMates does.

## What users see

On the **Deck Chart** tab, the **Try a Deck** icon button (`#sampleBtn`) next to Chart Deck opens a dialog:

- "Loading..." while the library downloads (the first time only); an error message if it fails.
- Home: **Browse by Archetype**, **Browse Precon Releases**, **Browse by Exact Style**, with deck counts.
- Lists of archetypes, styles, years and sets, then deck buttons (flavour name, tagline, commander). A back button
  returns through the navigation history.
- Picking a deck fills the list and commander, clears Player and Deck Name, closes the dialog and pulses **Chart
  Deck** (`tad-pulsing`) so you know what to press next.

## How it works

- `index.ts`: `mount(button, options)` binds the button; `showTryADeck(options)` opens the shared overlay
  (`openTadOverlay({ modalId: "tadModal" })`), awaits `options.load()` and renders. A dialog closed while loading
  is never filled in afterwards. Load failures report as operation `deck-library`.
- `state.ts`: the `SampleDeck` shape and pure navigation (`initialNavigation`, `navigate`, `back`), plus the
  year/set and archetype/style grouping.
- `view.ts`: lit templates for the loading state, home grid, lists and deck buttons. `try-a-deck.css`, prefix `tad-`.

Ports (`TryADeckOptions`, from `src/app/try-a-deck.ts`): `load()` awaits `loadDeckLibrary()` and returns
`deckLibrary()` (`services/card-data.ts`); `select(deck)` calls `fillDeckForm` / `setDeckNameChosen(false)`
(`services/deck-form.ts`) and pulses Chart Deck. It does not chart by itself.

Events: none. Data: the lazy dataset `public/data/TRY_A_DECK_OPTIONS.json` (fetched via `data/manifest.json`), loaded
only when the dialog opens or another feature needs the library. Decks marked `awaitsCards` are hidden until the
card DB knows all but two of their cards (`availableSampleDecks`). No Firestore, no local storage.

## Testing

- Unit: `try-a-deck.test.ts` (nested navigation is immutable, year/set filtering excludes curated namesakes, a
  closed dialog is not repainted).
- e2e: `smoke.spec.ts` (loading does not block DB-ready; closing cancels rendering; a sample charts),
  `r1-features.spec.ts` (releases, styles, blends, load a deck), `accessibility.spec.ts` (home and archetype list).
- By hand: press Try a Deck, go Browse Precon Releases → a year → a set → a deck; press Chart Deck. Reopen and try
  the back button from a deck list.

## Risks and rollback

The same library feeds the golden snapshots and the sample Gathering table, so a broken dataset shows in CI.
Roll back with `git revert` or Deploy Pages with an older `ref`.

## Follow-ups

- `src/app/try-a-deck.ts` casts the library rows (`as unknown as SampleDeck[]`): Try-a-Deck and Gatherings read the
  same data through different types (`docs/architecture.md`, "What is not done yet").

## Related

`004`, `005` (Chart Deck), `006` (deck form), `016` (Gatherings' sample table uses the same library).

Later changes: 036
