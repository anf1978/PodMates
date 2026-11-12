# Pipeline rules

Read the root `CLAUDE.md` and this folder's `README.md`. Run from the repo root with Node.js 22.18+.

- Never write into `src/` or splice application HTML. Pipeline output is data files
  (including data-only reports, manifests and workflow artifacts), not application source.
- Do not hand-edit `public/data/`, generated files or golden baselines. Change the
  builder, then deliberately review its output; never regenerate baselines to hide a failure.
- Preserve tuple positions, shard hashing, published filenames and dataset schemas.
  PriceScry name/hash/consensus helpers, `planTrade` and card mana-production logic live in
  `src/shared/` (one copy with the app). Pipelines import those `.ts` files directly; plain `node`
  (22.18+) strips the types, so keep them erasable TypeScript with no Node or DOM APIs.
- Keep each provider's descriptive User-Agent, request spacing and retry policy.
  Scryfall needs at least 100 ms between API calls (tags use 120 ms);
  Playgroup.gg stays at 250/minute, below its 400/minute allowance.
  tcgcsv keeps its cache/daily deduplication, 400 ms default delay and bounded backoff.
  Never bypass HTTP 403, hammer 429s, or retry forever; log refusal/exhaustion and stop.
- Use `lib/` for shared I/O, gzip, manifest and HTTP policy. Provider-specific collectors
  retain stricter policies; do not replace them with a less polite generic fetch loop.
- New or changed logic needs JSDoc types and fixture tests; `npm run check` includes
  `tsc -p pipelines/tsconfig.json` and all Vitest tests. Tests must not call live services.
- Validate shapes and plausible counts before writing or publishing; malformed input
  must throw rather than silently produce an empty/partial success.
- Secrets are environment variables only; never log tokens or credential-bearing URLs.
- Branch rebuilds publish to `data-<source-branch>`. PriceScry daily/backfill still
  target production `pricescry-data`: do not dispatch them as a feature-branch smoke test.
  Keep publication leases and concurrency locks. Never merge or deploy rules as part of this move.
