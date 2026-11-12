# 009: Scan cards from a photo

Date: 2026-11-12

## Summary

Scan Cards reads card names from photos of your physical cards and adds the ones you tick to the deck you are
building in Deck Crafter. The text recognition (OCR) runs entirely in your browser: photos are never uploaded.
It only finds names, never quantities, and it skips cards already in your deck or outside your commander's colours.

## What users see

Inside **Deck Crafter** (`010`), the **📷 Scan cards from a photo** button (`#dbScanBtn`) opens the dialog "Scan
Cards from Photo" with tips for good photos and:

- **Add a Photo…** (opens the hidden file input `#scanCardsFileInput`; several photos at once are fine).
- A status line "Reading photo 1 of N…", then "Done — found N new card(s)…" or the last error.
- A ticked list of found cards; **Rescan** re-reads the same photos; **Add … to deck** (`#scanCardsAddToDeckBtn`).
- Adding returns to Deck Crafter with a toast: "Added N scanned cards to your deck." plus how many were skipped for
  colour or because the deck is full. Close or Escape also returns to Deck Crafter.

## How it works

- `index.ts`: `mount(input, options)` returns `{ open, destroy }`. It keeps the last photos between openings, resets
  results on open, and uses a generation counter so an old OCR run cannot write into a reopened dialog. A failed
  photo stays reported even if a later one succeeds. Failures report as operation `card-scan`.
- `ocr.ts`: loads Tesseract.js 5 on first use from `cdn.jsdelivr.net` (allowed by the CSP), downscales and
  preprocesses the image on a canvas within fixed bounds, then recognises English text. Preprocessing failures fall
  back to the original or scaled image and log a warning.
- `state.ts`: `sortedNames` (names of 6+ letters, longest first), `matchPhotoText` (each name once, excluding
  cards in the deck) and `addScannedCards` (colour identity, distinct-card capacity and copy limits from
  `PM_LIMITS`).
- `view.ts`: dialog and results templates. `scan-cards.css`, prefix `scan-`.

Ports (`ScanOptions`, from `src/app/scan-cards.ts`): `cards` and `indexes` (`services/card-data`), `inDeck` (Deck
Crafter's cards plus the names in `#decklistInput`), `returnToBuilder` and `add`, both through
`services/deck-editing.ts`. The app registers the scanner there (`registerCardScanner`) so Deck Crafter can open it
without importing this feature.

Events: none. Data: no Firestore, no local storage. The card DB is the only dataset used.

## Testing

- Unit: `scan-cards.test.ts` (longest-first matching in noisy text, builder handoff limits, stale completions,
  failed photo stays visible).
- e2e: `r1-features.spec.ts` "scan accumulates matches, respects selection and rescans the same photo" (OCR mocked,
  real file input and Deck Crafter handoff).
- By hand on a phone: open Deck Crafter, pick a commander, press Scan, take a photo of a few cards with their names
  readable, tick the results and add them.

## Risks and rollback

If jsDelivr is unreachable the dialog shows the load error; the rest of the site is unaffected. The OCR library is
pinned to major version 5 only (`tesseract.js@5`), so a new 5.x release reaches users without a deploy.

## Follow-ups

- Consider pinning the exact Tesseract.js version (or self-hosting it) so OCR cannot change without a deploy.

## Related

`004`, `010` (Deck Crafter, the only entry point).
