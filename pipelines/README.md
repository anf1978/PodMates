# Data pipelines

Run from the repository root with Node.js 22+. Scripts remain `.mjs`; `npm run typecheck`
includes their JSDoc/`checkJs` project in `tsconfig.json`. `npm run check` includes the
builder fixtures and deterministic PriceScry simulation tests. No live API is used by tests.
Workflow definitions stay in `.github/workflows/`; paths below are relative to the repo root.

## Card database and function tags (`card-db/`)

- Inputs: Scryfall Oracle Cards bulk JSONL (plain or gzip, detected by magic bytes), plus
  Scryfall `otag:blink` and `otag:extra-combat` searches.
- Outputs: `build-card-db.mjs <bulk> [output.b64]` writes the existing gzip/base64
  16-field tuple payload; `fetch-function-tags.mjs [tags.json]` writes sorted front-face names.
  Malformed JSON rows and implausible counts fail before overwriting output.
- Schedule: `rebuild-card-database.yml`, Monday 06:00 UTC and `workflow_dispatch`.
- Secrets: automatic `GITHUB_TOKEN` (`contents: write`) for publication. No provider keys.
  Publication uses `lib/publish-datasets.mjs`: `data` on main, otherwise `data-<source-branch>`,
  retaining validated sibling datasets and manifest dates.
- Traffic: identified requests, 120 ms between Scryfall search pages; bounded transient retries.

## Commander win-rates (`winrates/`)

- Inputs: Playgroup.gg public `/commanders/{id}` responses, scanned sequentially until
  300 consecutive missing IDs. Keep records with at least 250 games and 10 decks.
- Outputs: `build-winrate-db.mjs [winrates.json]`, ranked `{n,t,w,g,r}` rows;
  500-5,000 qualifying commanders required before writing. Uses the same isolated
  publication helper as cards.
- Schedule: `rebuild-winrate-database.yml`, Monday 07:00 UTC and `workflow_dispatch`.
- Secrets: automatic `GITHUB_TOKEN` (`contents: write`), no Playgroup.gg key.
- Traffic: descriptive User-Agent, 250 requests/minute (240 ms between IDs), bounded
  retries honoring numeric `Retry-After` seconds; an exhausted scan fails, never publishes partial output.

## Commander Spellbook (`spellbook/`)

- Inputs: the public `variants.json` export, streamed because it exceeds safe string sizes.
- Outputs: `spellbook-snapshot.mjs <variants.json> <out-folder>` writes
  `spellbook-snapshot.json.gz` and `spellbook-stats.txt`. `spellbook-compact.mjs` exports
  the pure application-compaction/gzip helpers; it has no separate CLI.
- Schedule: manual `spellbook-snapshot-probe.yml` only. Results are workflow artifacts,
  never automatic application/engine baseline updates.
- Secrets: no provider secrets; automatic `GITHUB_TOKEN` with read access for checkout.
- Traffic: one identified export download; stop on refusal, do not crawl.

## PriceScry (`pricescry/`)

- Inputs: Scryfall `default_cards` bulk data, existing `pricescry-data` history,
  MTGJSON AllIdentifiers/AllPrices(Today), tcgcsv set/price data and exchange rates.
  Optional radar inputs are Reddit posts and publicly linked card images.
- Outputs: gzip card shards, index, FX rates, movers, radar, shadow/cheap-watch logs
  and evaluation data in the supplied data directory. `pricescry-lib.mjs` now lives
  in `lib/`; its name normalization/hash/shard helpers still mirror the inline app.
- Schedule: `pricescry-daily.yml`, daily 06:30 UTC and manual. **Daily and backfill
  still publish to production `pricescry-data`, even when dispatched on a feature branch.**
  They share their existing concurrency lock; do not dispatch them merely to validate a move.
- Manual workflows: `pricescry-backfill.yml` imports MTGJSON history and publishes;
  `pricescry-backtest.yml` and `pricescry-bulkjump.yml` read history and upload reports;
  `pricescry-probe.yml` makes one request to its `url` input and uploads the response.
  Study/risers/sim/link helpers support local research and tests; no extra schedules.
- Secrets: automatic `GITHUB_TOKEN` (write for daily/backfill, read for reports/probe);
  optional `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `ANTHROPIC_API_KEY` for radar.
  Never print secret values. Existing tcgcsv/Scryfall/MTGJSON User-Agents, spacing,
  retries and refusal handling remain in their provider-specific collectors.

## Publication, assembly and shared helpers (`lib/`)

- Inputs: completed card/tag/win-rate files and validated SHA-256 manifests;
  source branch (`GITHUB_REF_NAME`), revision (`GITHUB_SHA`), or an explicit assembly data ref.
- Outputs: `publish-datasets.mjs <cards|winrates> <input> [tags.json]` lease-pushes an
  orphan data-only commit; `assemble-datasets.mjs [data-ref]` writes `dist/data/` and
  provenance without resetting sibling metadata. `dataset-manifest.mjs` also supports
  the extraction/generation tools under `scripts/`.
- Schedule: publication follows the two Monday rebuilds; assembly runs in `deploy.yml`
  on main pushes, successful main rebuilds, or manual build-only dispatch.
  `deploy=false` prevents feature-branch Pages publication.
- Secrets: automatic `GITHUB_TOKEN` (write for publication, read for assembly);
  production Pages deployment separately uses its existing OIDC permissions.
- `http.mjs` owns identified JSON requests with polite bounded retry delays;
  `io.mjs` owns gzip input and gzip/base64 JSON writing; `cli.mjs` guards import-safe CLIs.

## Knowledge and reference corpus (not recovered)

`know-build`, `impact-cands` and reference-corpus builder sources are not in this checkout.
There is no runnable pipeline, schedule or secret contract to move for them. The committed
knowledge/reference datasets and extraction tools are unchanged. Recover original sources
before adding `knowledge/` or `reference-corpus/`; do not invent a replacement or rewrite baselines.
