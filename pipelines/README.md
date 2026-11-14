# Data pipelines

Run from the repository root with Node.js 22.18+ (built-in type stripping runs `src/shared/*.ts`). Scripts remain `.mjs`; `npm run typecheck`
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
- The manual `scryfall-tags.yml` research export runs `scryfall-tags.mjs`, preserving
  all 19 tags and full printed names in `scryfall-tags.json`. It is not replaced by
  the two-tag, normalized front-face export used by the app.

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
  and evaluation data in the supplied data directory. `pricescry-lib.mjs` lives
  in `lib/`; its name normalization/hash/shard, day and consensus helpers are re-exported from
  `src/shared/pricescry.ts` (shared with the app), and `planTrade` from `src/shared/trade-plan.ts`.
- Schedule: `pricescry-daily.yml`, daily 06:30 UTC and manual. **Daily still
  publishes to production `pricescry-data`, even when dispatched on a feature branch.**
  Its production concurrency lock is unchanged; do not dispatch it merely to validate changes.
- Manual workflows: `pricescry-backtest.yml` and `pricescry-bulkjump.yml` read history
  and upload reports. The one-off probes/backfill are archived below.
  Study/risers/sim/link helpers support local research and tests; no extra schedules.
- Secrets: automatic `GITHUB_TOKEN` (write for daily, read for reports);
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

## Workflow maintenance

Every Scryfall bulk consumer uses `.github/actions/scryfall-bulk/action.yml`.
`lib/scryfall-bulk.mjs` resolves fresh metadata on every run, prefers JSONL, streams
the download and preserves file-level gzip (consumers detect magic bytes). It sends
the project User-Agent, spaces requests, retries transient HTTP failures up to four
attempts, honors Retry-After (stopping if the requested wait exceeds 60 seconds)
and stops on refusal. Failed/empty
downloads never enter the cache. Cache keys include type, upstream timestamp and URL;
there is no stale restore-prefix fallback. HTTP Content-Encoding is decoded by fetch.

The weekly rebuilds intentionally remain separate: routing two schedules through one
workflow adds conditions without removing distinct builder/publication steps. Keeping
them preserves Monday 06:00 cards/tags, 07:00 win-rates, manual selective rebuilds and
the two existing `workflow_run` deployment triggers. Their shared publication lock
continues to serialize writes.

All third-party Actions are pinned to full commit SHAs with version comments.
Permissions are explicit per job; data/report workflows have concurrency groups.
Dependabot checks both Actions and npm weekly.

### Archived one-off workflows

These definitions last lived at commit
[`d35ef2d57d894eadfb7191f9f40f26a9a49955ea`](https://github.com/anf1978/PodMates/tree/d35ef2d57d894eadfb7191f9f40f26a9a49955ea/.github/workflows).
Their local pipeline scripts are retained; restoring a publishing workflow needs review.

| Deleted workflow             | Purpose / replacement                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `pricescry-probe.yml`        | One-URL response capture for source investigation; local `pricescry/pricescry-probe.mjs` remains.                      |
| `pricescry-tcgcsv-probe.yml` | One-off tcgcsv endpoints/network investigation; production collector is `pricescry/pricescry-tcgplayer.mjs`.           |
| `pricescry-backfill.yml`     | Run-once MTGJSON historical import into production; `pricescry/pricescry-mtgjson.mjs` remains for deliberate recovery. |

`spellbook-snapshot-probe.yml` is **not superseded**: it remains the only manual
artifact builder for the Commander Spellbook snapshot, never a baseline publisher.

## Precon benchmarks (`reference-corpus/`)

- `benchmark-baselines.mjs <out-dir>` builds `PRECON_FINGERPRINTS`, `STAPLES_BASELINE` and
  `MANABASE_BASELINE` from all Try-a-Deck samples with the engine and the committed card DB;
  `--update-public-data` writes them into `public/data/` and refreshes their manifest entries.
  The baselines' aggregation ports the recovered Nov 3, 2026 Python step (Python `statistics.median`
  and `round(x, 3)` semantics); fingerprints are `buildFingerprintVector()` per sample.
- `benchmark-baselines.test.mjs` requires the committed files to equal the builder's output (pinned
  golden fixtures). If an engine or sample-deck change breaks it, the benchmarks are stale: refitting
  moves the Deck Chart's Closest Match, staples and mana-base checks, so do it deliberately with a
  change doc (as in 034).
- Run by hand; no schedule, network access or secrets. `recovered/` keeps the original chat-session
  scripts verbatim as a record (see its README); they are never run.

- The same builder writes the reference set, `REFERENCE_SCORES` / `REFERENCE_TIERS`: one row of five
  one-decimal axis scores per sample (precons `p`, curated decks `t`; `NOT_IN_REFERENCE` lists samples
  not scored in yet), then the 30 tuned and 20 cEDH rows from `frozen-reference-rows.json`. Those decks'
  lists are lost, so their rows are carried forward and cannot be re-scored if the engine changes.

## Precon importer (`precons/`)

- Inputs: MTGJSON `DeckList.json`, `SetList.json` and one `decks/<file>.json` per candidate (public, no key),
  the latest `cards.json` (the `data` branch, else the committed snapshot) and the committed datasets.
- `import-precons.mjs --cards <cards.json> --report <md> [--change-doc-dir docs/changes]` appends new Commander
  precons (released on/after `IMPORT_SINCE`, not already present by name, key or commanders, exactly 100 cards, every
  card in the database) to `TRY_A_DECK_OPTIONS` with `addedAt` and suggested labels, refreshes the deck metadata
  and manifest entries, and writes the report and a change doc. Decks still missing cards or not yet released are
  reported as waiting.
- `snapshot-guard.mjs <before.snap> <after.snap>` allows golden snapshot additions only.
- Schedule: `precon-import.yml`, after each successful main `Rebuild Card Database`, and manual. It opens a
  `wip/precon-import` pull request for a human; it never merges. Secrets: none (`GITHUB_TOKEN` only).
- Traffic: identified User-Agent (`PodMatesPreconImport/1.0`), two list files plus one deck file per new deck,
  1 s apart, bounded retries via `lib/http.mjs`; deck files are fetched only for new candidates.

## Knowledge lists (not recovered)

`know-build` (`KNOW_JSON`) and `impact-cands` (`IMPACT_CANDS`) are not in this repository; its full history
(361 commits from 2026-09-07) and the owner's chat sessions were searched in November 2026. They also need
inputs that are not here (the ranked community card lists). The committed datasets are frozen: they work,
but cannot be refreshed. Do not invent replacements or rewrite them.
