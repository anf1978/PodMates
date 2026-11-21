# 046: Scan Cards reads black-name and white-name cards better

Date: 2026-11-21

## Summary

Card names printed in white (on dark frames) were often missed by the scanner. The scan dialog now asks
for the colour of the card names, **Black text**, **White text** or **Mixed**, and tunes the photo for that
colour. Sorting cards by name colour and scanning each pile with the matching choice finds noticeably more
names.

## What users see

- A **Names:** choice above the photo buttons: Black text (the default), White text or Mixed. The choice
  is kept while the page is open.
- Each photo is read more than once, so a scan takes a little longer; the status shows
  "Reading photo 1 of 2, pass 2 of 3…". Mixed reads three times.
- **Rescan Same Photo(s)** uses the current choice, so you can scan black, switch to White text, and rescan
  the same photo.
- **Tips for a good photo** now starts with: sort cards by name colour and scan each pile with its choice.
  The Scan Cards first-use tip mentions choosing the colour.

## How it works

- New `src/features/scan-cards/enhance.ts` (pure, no DOM):
  - `stretch()` is the original clean-up.
  - `colourFilter()` keeps only strokes darker (black) or lighter (white) than the local average over a
    window of about a letter's height (summed-area table; white strokes are drawn dark).
  - `filtersFor()` maps the choice to filters.
- `ocr.ts`: `preprocessImage(file, colour)` returns the stretched photo plus one image per filter.
  `readPhoto(file, colour, progress)` reads each one and joins the text, so names found in any pass count.
  When pixels can't be read, the photo is read once as before.
- `index.ts` keeps the choice and shows pass progress; `view.ts` adds the radio group (`name="scanColour"`).
- Why not just invert white text: the OCR engine (Tesseract 5) already flips light-on-dark lines itself.
  Inverting alone scored exactly the same as not inverting. The filter helps because it removes the
  other colour's text and frames.
- No data changes; photos still never leave the device.

## Measurements

Real Tesseract 5 (English, best_int data) on generated photos of 12 fanned cards each. The photos had
rules-text clutter, uneven light, a glare spot, blur and grain; three photos per set; names found out of 36.

| Set (choice)                  | Before (one pass) | After (combined passes) |
| ----------------------------- | ----------------- | ----------------------- |
| Black-name cards (Black text) | 29                | 31                      |
| White-name cards (White text) | 17                | 26                      |
| Mixed photo (Mixed)           | 26                | 29                      |

The wrong choice on its own finds almost nothing (0–1 of 12), which is why the plain pass always runs too.
Generated photos are not real ones, so real gains will vary.

## Testing

- `enhance.test.ts`: stretch, each filter keeping its own colour and dropping the other, and `filtersFor`.
- `scan-cards.test.ts`: the choice reaches the reader, is kept between openings, and the pass progress
  shows.
- The e2e scan test is unchanged.
- The dialog still fits one screen at iPhone SE, iPhone 13 and Pixel 7 sizes.

## Risks and rollback

Scans take about two or three times as long on a slow phone. Revert with `git revert <sha>`.

## Follow-ups

None.

## Related

009 (Scan Cards), 045 (one-screen dialog), 041 (first-use tip).
