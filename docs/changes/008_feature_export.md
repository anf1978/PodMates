# 008: Export a deck for Archidekt or Moxfield

Date: 2026-11-12

## Summary

Export turns the deck you just charted into plain text that Archidekt and Moxfield can import: a "Commander"
section and a "Deck" section with quantities and full card names. You copy it with one button and paste it into
either site's bulk importer. Nothing is sent anywhere by PodMates itself.

## What users see

On the **Deck Chart** tab, the **Export for Archidekt/Moxfield** icon button (`#exportDeckBtn`):

- If no deck has been charted yet: "Chart a deck first, then export it." in `#deckMgmtStatus`.
- Otherwise a dialog titled "Export for Archidekt/Moxfield" with a read-only text box and **Copy to Clipboard**.
  The status line says "Copied." or, if the browser refuses, asks you to select and copy the text by hand.

## How it works

- `index.ts`: `mount(button, current)` binds the button; `showExportDeck(deck)` opens the shared overlay
  (`openTadOverlay()`) and handles the clipboard. Clipboard failures report as operation `deck-export`.
- `state.ts`: `buildExportText` writes `Commander`, one `1 <name>` line per commander (partners once each), a
  blank line, `Deck`, then `<qty> <full name>` for every matched card except the commanders. Double-faced cards
  keep their full `Front // Back` name.
- `view.ts`: the dialog template; the text is bound as a property, never as markup. `export.css`, prefix `export-`.

Port (from `src/app/export.ts`): `current()` returns `{ matched, commanders }` from `currentChart()`
(`services/current-chart.ts`), or `null` before the first chart. It exports the **charted** deck, not unsaved edits
in the text box.

Events: none. Data: none (no Firestore, no local storage, no network).

## Testing

- Unit: `export.test.ts` (partners written once, quantities and full names kept, section boundaries round-trip).
- e2e: `r1-features.spec.ts` "export copies commander sections and full double-faced card names" (real clipboard).
- By hand: chart any Try a Deck sample, press Export, press Copy to Clipboard, paste into Moxfield's or Archidekt's
  import box and check the commander lands in the command zone.

## Risks and rollback

Low: a formatting slip would only affect the pasted text. Roll back with `git revert`.

## Follow-ups

None.

## Related

`004`, `005` (the charted deck in `services/current-chart.ts`).
