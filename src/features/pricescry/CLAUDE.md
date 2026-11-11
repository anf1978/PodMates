# PriceScry feature

Card price history, movers, signals, spoiler radar and a trade planner, shown in yen. Read the root `CLAUDE.md`
first; data plumbing is in `src/services/price-data.ts`, and the publishing side is `pipelines/pricescry/` plus
`.github/workflows/pricescry-daily.yml`.

## Loading

- `index.ts` (public API, event listeners), `runtime.ts` (ports) and `pricescry.css` load with the page.
- `access.ts`, `screen.ts` and every view are one lazy chunk, fetched by `import()` the first time someone
  opens PriceScry. Don't import them from `index.ts` statically, or the chunk merges into the main bundle.
- Entry: profile emits `pricescry:open`; Trades emits `pricescry:tab` ("ledger") after a save (ignored while the
  screen is closed). `legacy-globals.ts` publishes nothing; it supplies the ports (Ledger and Spoiler Bait mounts
  via their shims, the inline card picker, card-DB badges).

## Data branch

- Read-only from `https://raw.githubusercontent.com/anf1978/PodMates/pricescry-data/`, written once a day by the
  daily workflow (force-pushed). Files: `index.json` (day, firstDay, card count), `fx.json`, `movers.json`,
  `signals.json.gz`, `shadow-report.json`, `cheapwatch-report.json`, `radar.json`, `cards/NNN.json.gz`.
- `fetchPriceData` caches each path for the page's lifetime and unzips gzip by magic bytes (a server may already
  have unzipped it). A 404 means "not published yet", which views show as a message, not an error.
- Never dispatch the daily/backfill workflows from a feature branch: they publish to production `pricescry-data`.

## Shard format

- Cards live in 512 shards: `cards/` + `fnv1a(nameKey(name)) % 512` padded to 3 digits + `.json.gz`, holding
  `{ cards: { [nameKey]: record } }`. A record has `n` (name), `rs` (Reserved List), `gc` (Game Changer), `er`/`ers`
  (EDHREC rank and history), `p` (printings: Scryfall `id`, set `s`/`sn`, `cn`, release `r`, series `pr`) and `jp`.
- Series are change points `[[day, value], …]`: the value holds from that day until the next point. Days count
  from 2020-01-01 UTC; USD/EUR are cents, yen is yen, `fx.json` rates are yen × 10,000.
- Series keys: Scryfall `u`/`e` (non-foil US/EU), `uf`/`ef`, `ue`; MTGJSON `x` + provider (`t`/`c`/`k`/`m`) +
  kind (`r` retail, `b` buylist) + finish (`n`/`f`/`e`). MTGJSON wins for US/EU when present (back-filled history).

## KEEP IN SYNC

- `nameKey()`, `fnv1a()` and `shardPath()` in `src/services/price-data.ts` = `nameKey()`, `fnv1a()`,
  `shardFile(shardOf())` in `pipelines/lib/pricescry-lib.mjs`. Change both or neither: a different hash makes every
  published shard unreachable. `consensusCents()` follows `consensusAt()` there.
- `planTrade()` in `plan.ts` = `planTrade()` in `pipelines/pricescry/pricescry-study.mjs`.
- `src/services/price-data.test.ts` and `plan.test.ts` compare each pair. p5-3 replaces the copies with one shared
  module; until then, edit both sides in the same PR.

## The password is a soft gate

The SHA-256 of the word is in `access.ts` and the page is public, so anyone can find or guess it. It keeps
casual visitors out, nothing more. Never put anything sensitive behind it; real protection needs a server.
"Unlocked" lasts for the browser session (`sessionStorage.pricescryUnlocked`).

## Rendering rules

- Views `paint()` into `#psBody` (render into a fragment, then replace), matching the old `innerHTML` screen.
  The Ledger and Spoiler Bait ports replace `#psBody`'s children themselves, so never keep a lit part on it.
- Keep cached re-renders synchronous (no `await` when data is already loaded). The modal focus trap refocuses
  when the clicked chip disappears; if that happens while "Loading…" is showing, the screen scrolls to the top.
- Inline text runs: one interpolation per run (see root Gotchas); `cardLink` is `prettier-ignore` for that reason.
- `pricescry.css` loads before the main stylesheet. A selector that ties on specificity with an earlier global rule
  (e.g. `button:hover`) now loses, so restate it (see the tab/range button rules).
- The planner's result lines use `.ps-lotline` from `ledger.css`; trade dialogs use `trades.css`.
