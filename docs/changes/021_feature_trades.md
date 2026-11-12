# 021: Trades (record card purchases and sales)

Date: 2026-11-12

## Summary

Trades is the bookkeeping behind PriceScry's Ledger. You record cards you bought (real or "paper" pretend trades),
later record sales with marketplace fees and shipping, set your own price check for a card, and export everything as
a spreadsheet file. Amounts are Japanese yen; the default sale costs follow Mercari (10 % fee, ¥230 shipping, ¥30
packing). Everything is stored in your own account.

## What users see

Dialogs opened from PriceScry (`026`) and its Ledger tab (`022`):

- **Add a trade** / **Paper trade** / **Edit trade**: card (shared card picker), version (non-foil, foil, etched),
  quantity, buy price, extra costs, date, shop, **Why (optional)** (riser, spoiler, other) and a note. A purchase
  cannot drop below the quantity already sold. PriceScry's **card page** opens it pre-filled with the current price.
- **Record a sale** / **Edit sale**: quantity, price, fee %, shipping, packing, date, with a profit preview.
- **My price check**: your own value for an open lot (overrides the market price in the Ledger), or clear it.
- Confirmations ("No" / yes) before removing a sale or deleting a trade; removing a sale returns those cards to open.
- **Export**: downloads `pricescry-trades-YYYY-MM-DD.csv` (UTF-8, fixed column order, sale accounting included).

## How it works

- `index.ts`: `mount(ports)`, `openTradeForm`, `openSellForm`, `openMarkForm`, `confirmRemoveSale`,
  `confirmDeleteLot`, `exportTrades`. Async lookups and saves cannot change or dismiss a replacement dialog; write
  errors report and keep the form and its original message for retry.
- `state.ts`: pure form rules and validation (yen rounding, sold-quantity floor, fee 0–30 %, dates `YYYY-MM-DD`);
  re-exports the shared accounting from `src/services/trade-ledger.ts` (`COSTS`, net proceeds, cost basis,
  partial/closed positions, `toInt`, `TradeDraft`), which Ledger also uses.
- `csv.ts`: the CSV schema and download. `view.ts`: escaped templates (reusing PriceScry's `ps-` form classes);
  `trades.css` holds only form layout.

Ports (`runtime.ts`, from `src/app/trades.ts`): `lots` and `mark` (the Ledger snapshot in
`services/trade-ledger.ts`), `currentYen` (`services/price-data.ts`), `nameKey` (`src/shared/pricescry.ts`),
`wireSearch` (shared `ui/card-search` over the page card DB), `refresh` (emits `pricescry:tab` `"ledger"`).

Events: the app routes `trades:purchase` (PriceScry card page), `trades:mark`, `trades:sell`,
`trades:remove-sale`, `trades:remove-lot` and `trades:export` (Ledger) to the functions above; Trades emits
`pricescry:tab` through `refresh`.

Data (Firestore, `src/services/cloud/trades.ts`; names exact): `users/{uid}/trades/{id}` = `card`, `key`, `finish`
(`""` / `nonfoil` / `foil` / `etched`), `paper`, `qty`, `buyYen`, `buyExtraYen`, `buyDate`, `shop`, `tag` (`""` /
`riser` / `spoiler` / `other`), `note`, `sells` (array of `{ qty, yen, feePct, shipYen, packYen, date }`),
`markYen`, `markDate`, `createdAt`, `updatedAt`. Prices come from PriceScry's published data. No local storage.

## Testing

- Unit: `trades.test.ts` (yen parsing, limits, sold floor, fee rounding, cost basis, sale edits, closed positions,
  CSV order and quoting, repository saves and Ledger refresh, edit preserving sales, mark clearing, confirmations,
  failure/retry, stale price lookups and saves).
- e2e: `trades.modules.spec.ts` (purchase validation, sale preview, price-check cancel; no authenticated writes).
  The purchase, sale and price-check screenshots matched the pre-extraction views.
- By hand: signed in, open PriceScry, open a card, add a paper trade; in Ledger record a sale, edit it, export CSV.

## Risks and rollback

Trades are personal financial records; a revert does not undo writes. Never change field names. Roll back code with
`git revert`.

## Follow-ups

None.

## Related

`004`, `022` (Ledger), `026` (PriceScry).
