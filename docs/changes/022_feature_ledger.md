# 022: Ledger (PriceScry's trade results)

Date: 2026-11-12

## Summary

The Ledger is a tab inside PriceScry that adds up your card trades: profit already made on sales, what your unsold
cards would make if sold today after fees, how much each closed trade earned on average, and results by reason
(riser, spoiler, other). You can filter real trades from paper (pretend) ones and jump into the Trades dialogs to
add, edit, sell or export. It needs an account.

## What users see

PriceScry (`026`) → **Ledger** tab:

- **Signed out**: "Sign in to keep a trade ledger. It is saved to your account, so it follows you between devices."
- **All / Real / Paper** filter; totals: **Realised profit**, **Unrealised (if sold today, after costs)**,
  **Expectancy per trade** (yen and % of money in), with a note when some prices are missing.
- **By reason** summary, **Open positions** (each with your price check or the market price, **Sell**, price check,
  edit, delete) and **Closed trades** (sales with edit/remove).
- **Add** and **Export** buttons (`#psExportTrades`). Explanation: unrealised = what open cards would net if sold
  today; paper trades use pretend money.

## How it works

- `index.ts`: `mount(host, ports)` returns `{ ready, destroy }`. It owns a `ledger-content` root inside the host, so a
  late repository or price response cannot paint over another tab; generation and account checks stop stale lots or
  marks being published into the shared snapshot. It prices open lots, then fills `ledgerSnapshot` (`lots`, `marks`)
  in `src/services/trade-ledger.ts`, which Trades reads.
- `state.ts`: pure filters (`FILTERS`, `shownLots`) and `ledgerStats` (realised, unrealised, expectancy, by-reason,
  price coverage) over the shared `lotMetrics`.
- `view.ts`: escaped templates and action buttons. `ledger.css`.

Ports (`LedgerPorts`, from `src/app/pricescry.ts` `renderLedger`): `currentYen` (`services/price-data.ts`) and
`actions` (`add`, `edit`, `mark`, `sell`, `removeSale`, `removeLot`, `export`), which emit the typed `trades:*`
events handled by Trades (`021`).

Events: emits (through ports) `trades:purchase`, `trades:mark`, `trades:sell`, `trades:remove-sale`,
`trades:remove-lot`, `trades:export`. Trades returns here with `pricescry:tab` `"ledger"`.

Data: reads `users/{uid}/trades` (`src/services/cloud/trades.ts`; fields in `021`) and the session
(`cloud/session`); prices from PriceScry's published data. Writes nothing itself. The All/Real/Paper filter is kept in
memory for the page load only; no local storage.

## Testing

- Unit: `ledger.test.ts` (filters, partial sales, expectancy, missing marks; own marks, escaping, routed actions; no
  paint or publish after tab replacement or account change; sign-in and repository-failure states).
- e2e: `ledger.spec.ts` (the real tab's sign-in boundary; survives leaving and reopening the tab, without
  authenticated calls). Authenticated behaviour is repository-mocked only.
- By hand: signed in with a trade or two, open PriceScry → Ledger, switch All/Real/Paper, press Export.

## Risks and rollback

Read-only display; a bug shows wrong totals but cannot change trades. Roll back with `git revert`.

## Follow-ups

None.

## Related

`004`, `021` (Trades), `026` (PriceScry).
