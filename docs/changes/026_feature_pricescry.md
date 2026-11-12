# 026: PriceScry (card prices in yen)

Date: 2026-11-12

## Summary

PriceScry is a full-screen price tool inside PodMates for following Magic card prices, shown in Japanese yen: price
history charts per printing and finish, today's biggest movers, spoiler and price signals, a spoiler radar, a trade
planner, a Ledger of your own trades and Spoiler Bait. The data is rebuilt once a day by a GitHub Actions workflow
and read straight from a data branch. It sits behind a simple password that only keeps casual visitors out; it is
**not** security.

## What users see

- Entry: the **PriceScry** button in My Profile (`014`). The first time each browser session, a password prompt;
  a wrong word is refused.
- Tabs: **Search** (card search → card page), **Movers**, **Signals** (spoiler strip, prediction scoreboard,
  cheap-pick watch), **Bait** (Spoiler Bait, `019`), **Radar**, **Ledger** (`022`).
- **Card page**: printing and finish pickers, an SVG price chart with a readout and ranges, current prices, Game
  Changer / banned badges from the card DB, facts (Reserved List, EDHREC rank), the **trade planner**, and a button
  that opens a purchase in Trades (`021`). Back returns to the same list.
- Data not published yet shows as a message, not an error. Escape closes the screen.

## How it works

The detailed technical notes are in [`src/features/pricescry/CLAUDE.md`](../../src/features/pricescry/CLAUDE.md)
(loading and the lazy chunk, the data branch and its files, the shard format and series keys, code shared with the
pipelines, the soft gate, rendering rules). In short:

- Eager: `index.ts` (`mount()` listens to `pricescry:open` and `pricescry:tab`; `requestPriceScryAccess()`),
  `runtime.ts` (ports) and `pricescry.css`.
- Lazy chunk `pricescry-screen` (via `import("./pricescry-screen")` only): `access.ts` (password gate), `screen.ts`
  (overlay, tabs, `#psBody`), `card.ts`, `chart.ts`, `plan.ts`, `movers.ts`, `signals.ts`, `boards.ts`, `radar.ts`,
  `state.ts`, `dom.ts`.
- `src/services/price-data.ts` fetches and caches the published files, decodes series and converts to yen
  (`currentYen`), shared with Trades and Ledger. `src/shared/pricescry.ts` (name key, shard hash, consensus) and
  `src/shared/trade-plan.ts` (`planTrade`) are the same code the pipelines run.

Ports (`PriceScryPorts`, from `src/app/pricescry.ts`): `renderLedger` (mounts Ledger with trade actions that emit
`trades:*`), `renderBait` (mounts Spoiler Bait with signals, day, active pod and card navigation), `wireSearch` (the
shared `ui/card-search` picker over the page card DB), `findCard` (card-DB badges).

Events: listens to `pricescry:open` (My Profile) and `pricescry:tab` (Trades, after a save; ignored while closed);
the card page emits `trades:purchase`.

Data:

- Read-only from the `pricescry-data` branch (`https://raw.githubusercontent.com/anf1978/PodMates/pricescry-data/`),
  written daily by `.github/workflows/pricescry-daily.yml` from `pipelines/pricescry/`. Never dispatch that workflow
  for testing: it publishes to production.
- Session storage `pricescryUnlocked` = `"1"` once the password was accepted (this browser session only).
- Ledger, Trades and Spoiler Bait keep their own Firestore data (`021`, `022`, `019`); PriceScry itself has none.

## Testing

- Unit: `pricescry.test.ts` (MTGJSON vs Scryfall series, cheapest non-foil printing, chart sampling and yen,
  signal grouping and spoiler de-duplication, password gate, unlocked session, tab switching on trade events),
  `src/shared/pricescry.test.ts` (pinned shard vectors; never update them to make a change pass).
- e2e: `pricescry.spec.ts` with `pricescry-fixture.ts` (password once per session; search → card → back; Movers,
  Signals and Radar open cards), `modal.spec.ts` (scroll lock and Escape), `pwa.spec.ts` (the lazy chunk updates with
  main), `spoiler-bait.spec.ts`, `ledger.spec.ts`.
- By hand: My Profile → PriceScry, enter the password, search a card, switch printings and ranges, open Movers and
  Signals, close and reopen (no password asked again until the browser session ends).

## Risks and rollback

Changing the shard hash or name key strands every published shard. A broken daily run leaves yesterday's data in
place. Roll back the site with `git revert`; the data branch is managed by its workflow.

## Follow-ups

- `runtime.ts` calls `wireSearch` "the legacy card picker"; it is the shared typed `ui/card-search` now (stale
  comment).

## Related

`004`, `014` (entry point), `019` (Bait tab), `021` (Trades), `022` (Ledger);
[`src/features/pricescry/CLAUDE.md`](../../src/features/pricescry/CLAUDE.md), `pipelines/README.md`, ADR D3.
