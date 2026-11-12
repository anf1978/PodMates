# 011: Card viewer (View Deck, card art and commander portraits)

Date: 2026-11-12

## Summary

The card viewer shows card pictures. **View Deck** lays out your whole list as a gallery grouped by card type, a
row of the Card Type Frequency table opens just those cards, tapping any card name opens that card's art (with a
flip button for double-faced cards), and the commander portraits appear above the radar when you chart a deck.
Pictures come straight from Scryfall and are never stored.

## What users see

- **View Deck** icon button (`#viewDeckBtn`) on the Deck Chart tab: a wide dialog with commanders first, then
  Planeswalker, Battle, Creature, Sorcery, Instant, Artifact, Enchantment, Land; each card once, with its quantity
  and a placeholder when no art was found. Toasts if the DB is loading, the box is empty or nothing matches.
- **Card Type Frequency & Curve** rows (`[data-type-name]`): the cards of that type from the last chart.
- **Any card name** with `data-card-name` (in panels, profiles, Load a Deck, pods): a small stacked art dialog
  (`#tadArtOverlay`) that opens on top of whatever is already open. Faces with `data-flip-btn` swap to the other
  side.
- **Commander portraits** (`#commanderHeroArea`): up to two, above the radar; a missing image just hides its slot.

## How it works

- `index.ts`: `showDeckViewer(matched, commanderNames)`, `showTypeCards(typeName, entries)`,
  `showSingleCardArt(name)` (stacked overlay; ignores a fetch that finishes after close), `mountCommanderHero()`
  (listens to `chart:commanders`) and `renderCommanderHero` (a run counter drops portraits from an older chart).
- `state.ts`: `groupDeck` (one bucket per card by priority, commanders first; unlike the engine's
  `typeFrequency`, which counts an Artifact Creature twice), `typeTiles` and `VIEWER_CATEGORY_ORDER`.
- `view.ts`: loading, gallery, type, single-art and portrait templates. `card-viewer.css`, prefix `cv-`.

Wiring (no ports object): `src/app/card-viewer.ts` binds View Deck to the form fields (parse, match, commander from
`parseCommanderField`) and calls `mountCommanderHero()`. `src/app/card-clicks.ts` is the page-wide delegate for
`[data-flip-btn]`, `[data-card-name]` and `[data-type-name]`, registered before other document listeners; it skips
`[data-go-key-pieces]`, `[data-explain]` and `[data-gc-card]`, which Deck Chart's explainers own. Type rows read
`currentChart().agg.cardsByType`.

Events: listens to `chart:commanders` (emitted by Deck Chart, `005`).

Data: `services/card-art.ts` fetches image URLs from the Scryfall API (`fetchCardImageUrl`, batched
`fetchCardImagesBatch`; case-insensitive, split cards retried by their front face) and caches them **in memory for
the page load only**. The service worker caches the images themselves (CacheFirst with limits). No Firestore, no
local storage.

## Testing

- Unit: `card-viewer.test.ts` (one bucket per card, type-row sums, face order, case-insensitive and split-card
  lookups, gallery rendering with placeholders, portraits only for found art).
- e2e: e2e fulfils Scryfall locally (`tests/e2e/offline.ts`); the smoke test charts a deck, which draws the
  portraits. `modal.spec.ts` opens the single-card art layer from a `[data-card-name]` on top of another dialog and
  checks that Escape closes only that layer. No spec opens View Deck or a type row.
- By hand: chart a sample deck, press View Deck, tap a card name in Key Pieces, tap a Card Type row, and flip a
  double-faced commander portrait.

## Risks and rollback

If Scryfall is slow or down, galleries show placeholders; nothing else breaks. Scryfall asks for polite traffic,
so keep requests batched. Roll back with `git revert`.

## Follow-ups

- No e2e covers View Deck or the Card Type row galleries.

## Related

`004`, `005` (Deck Chart emits `chart:commanders` and holds the charted deck).
