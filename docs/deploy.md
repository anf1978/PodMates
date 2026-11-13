# Deploying PodMates

The site stays at <https://anf1978.github.io/PodMates/>. Switching the Pages source is a human-only
step; adding these workflows does not change the repository's Pages settings.

## CI and deployment

`.github/workflows/ci.yml` runs on every push to `main`, `ccr-*`, `claude/**` and `wip/**`, on pull requests and on manual dispatch. It uses
Node 22, cached npm downloads, `npm ci`, `npm run check` (types, lint, unit and golden tests), the build and
bundle budget, then Playwright Chromium against a production build; a second job runs the Firestore rules
tests. Superseded branch and PR runs are cancelled, but every commit on `main` runs to completion so each one has its
own verdict. Failed browser tests upload a seven-day `playwright-report` artifact.

Each job ends with `scripts/ci-summary.mjs`, which writes a short Markdown summary to the run's
**Summary** page (each step's result, failing test names, the first error lines and, when golden tests
fail, `git diff --stat` of what `golden:update` would change) and adds `::error` annotations. That page is
readable on a phone without downloading anything; see [phone-workflow.md](phone-workflow.md).

`.github/workflows/deploy.yml` builds with Node 22 and Vite, uploads **only `dist/`** as the
`github-pages` artifact, then publishes with `actions/deploy-pages`. The deployment job alone gets
`pages: write` and `id-token: write`; builds get `contents: read`. The `pages` concurrency group
serializes runs without cancelling a deployment in progress. Third-party actions are pinned to full
commit SHAs with version comments; Dependabot opens one grouped weekly PR per ecosystem (Actions, npm) for
minor and patch updates and ignores major bumps, which a session does on request.

### The deploy gate: only commits whose CI passed go live

Deploy Pages has **no push trigger**. Its first job runs `scripts/resolve-deploy-commit.mjs`, which uses the
GitHub API (read-only token) to pick the commit to build; a commit counts as green when its newest completed
`CI` run on `main` (push or dispatch, not pull request) succeeded. The run's Summary page says what it chose
and why.

| Trigger                                             | What it builds                                                                      | Publishes?                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| `CI` completed on `main`, failed or cancelled       | nothing                                                                             | no: production stays on the last good build |
| `CI` succeeded on `main`                            | that commit, if it is the newest green commit on `main`                             | yes; an older run finishing late is skipped |
| A weekly rebuild succeeded                          | the **newest green commit** on `main` (walks back up to 40 commits past a red head) | yes                                         |
| Manual run, `ref` set, **deploy** ticked (rollback) | that commit; refused unless it is on `main` and passed CI                           | yes, even over a newer commit               |
| Manual run, no `ref`, **deploy** ticked             | the newest green commit                                                             | yes                                         |
| Manual run, **deploy** unticked                     | `ref`, or the selected branch                                                       | no (build-only check)                       |

Publishing also requires the run to start from `main` (the workflow file on `main`), so a manual run on any
other branch cannot publish. Runs are serialized by the `pages` concurrency group and each picks its commit when
it starts, so a newer pending run supersedes an older one and the newest green commit always wins. Because the
script ignores the triggering run's commit apart from comparing it, a CI run reported for a fork's branch
named `main` can never be checked out or deployed. `tests/deploy-gate.test.ts` covers every row.

**Rollback:** Actions → Deploy Pages → Run workflow → branch `main`, `ref` = the good commit, tick **deploy**.
It is instant but temporary: the next merge or data refresh deploys `main` again, so also revert the bad
commit (`git revert <sha>` from a session branch). Rollback works for any commit on `main` whose CI run still exists. No
PR-preview hosting environment is created here ([ADR 0008](adr/0008-no-pr-previews.md)).

### Auto-merge: session branches ship themselves

Sessions never push to `main` ([phone-workflow.md](phone-workflow.md)). They push their own branch: `ccr-<id>`, the
branch a Claude cloud session starts on, or `claude/<topic>`. `ci.yml` runs the full CI on them. When a `CI` run on
such a branch of this repository (not a fork) succeeds,
`.github/workflows/auto-merge.yml` runs `scripts/auto-merge.sh` from a checkout of `main`:

1. It skips a branch that has moved on since the tested commit (that commit's own CI decides) or whose latest
   commit message contains `[wip]` (how a session saves unfinished work). It refuses unless the branch's latest
   commit has a successful `CI` run.
2. It rebases the branch onto `main`. When `main` hasn't moved this is a no-op and `main` gets exactly the tested
   commits. A conflict fails the run and nothing is pushed. It then pushes `main` (retrying on a race, never
   forcing) and deletes the branch with a lease, so a newer push to the branch is never lost.
3. Pushes made with the Actions token start no workflows, so `scripts/dispatch-and-watch.sh` dispatches `CI` on
   `main` and waits for it. If it passes, Deploy Pages is dispatched (deploy ticked, no `ref`), and the gate above
   deploys the newest green commit. If CI on `main` fails, the Auto-merge run fails and nothing deploys.

Runs share one concurrency group, so merges happen one at a time, each on top of the previous one. `wip/` branches
get CI and are never merged. The Actions token can't push changes to `.github/workflows/`, so for those branches
the script opens a PR (this needs Settings → Actions → "Allow GitHub Actions to create and approve pull requests")
and a human merges it. `tests/auto-merge.test.ts` runs the script against throwaway git repositories: fast-forward,
rebase, red CI, moved branch, conflict, workflow files, `ccr-` branches, `[wip]` and other branch names.

`node scripts/ci-status.mjs <branch>` follows a branch through CI, Auto-merge, CI on `main` and Deploy Pages with
the public API. It prints failing jobs' error annotations and the next step, and exits 0 when deployed, 1 on
failure and 2 while in progress.

### Snapshot updates without a terminal

`.github/workflows/update-snapshots.yml` (manual, required `reason` input) runs `npm run golden:update` and
`npm run e2e -- --update-snapshots` on Linux. It commits any changes with the reason in the message: to the branch
it was started on when that's a `ccr-`, `claude/` or `wip/` branch, otherwise to a new `claude/snapshots-<run id>` branch.
It then dispatches and waits for `CI` on that branch and, for `ccr-`/`claude/` branches, dispatches Auto-merge. Use it only
for an intended engine change whose change doc explains the golden diff (`/engine-change`).

### Precon import (proposals a human merges)

`.github/workflows/precon-import.yml` runs after each successful `Rebuild Card Database` on `main` (and on demand).
`pipelines/precons/import-precons.mjs` reads MTGJSON's `DeckList.json`/`SetList.json` and, for Commander decks
released on or after `IMPORT_SINCE` that Try a Deck lacks and whose every card is in the `data` branch's
`cards.json`, appends Try-a-Deck entries (`addedAt` = today; suggested archetype, style and tagline) and writes a
numbered change doc. The workflow then extends the golden fixtures with `generate-fixture.mjs --add` (pinned cards
kept first and unchanged), rebuilds the precon benchmarks and reference set from the fixtures, writes golden
snapshots for the new decks and runs `snapshot-guard.mjs` (any changed existing snapshot fails the run), then
`npm run check`. It force-pushes the proposal to its own `wip/precon-import` branch, opens or updates a pull request
that requests the repository owner's review, and dispatches CI on it. `wip/` branches never auto-merge: a human
reviews the labels and taps **Merge**, which deploys through the gate as usual. With nothing new, it ends after the
report on its Summary page. Permissions: `contents`, `pull-requests` and `actions` write; no secrets.

### Weekly data refreshes

The card and commander win-rate rebuilds publish JSON files to the force-updated `data` branch using
`GITHUB_TOKEN`, never to application source. Those pushes **do
not trigger `push` workflows**. Instead, deployment listens for successful `workflow_run` completion
of `Rebuild Card Database` and `Rebuild Commander Win-Rate Database`, restricted to runs on `main`.
Failed rebuilds do not deploy; a successful no-change rebuild can harmlessly redeploy.

The downstream checkout uses the newest commit on `main` whose CI passed (see the gate above), not the
upstream run's `head_sha` and not `main`'s head, so a red `main` never holds back new data.
After building, `assemble-datasets.mjs` resolves an exact data revision, validates the publication's hashes
and copies the three bot datasets into `dist/data/`. It merges their metadata into `dist/data/manifest.json`,
preserving static-dataset entries. `dist/data/build-manifest.json` and the Actions summary
record the revision and hashes. If the branch does not exist yet, validated committed fallback snapshots
are used; a malformed existing publication fails rather than silently reverting data. No PAT, additional secret or
write permission on the rebuild token is needed. Both workflow files must first be on the default
branch for this trigger to work. Keep the workflow names in sync if renaming either rebuild.

Both publishers share a concurrency group, preserve the other dataset files, and use an explicit push lease
to reject concurrent updates. Every published revision is an orphan commit, avoiding weekly data history.
Optional tag-fetch failures retain the previous validated tags with a warning; invalid supplied tags abort.
Manual rebuilds on non-main branches publish to `data-<source-branch>`, never production `data`.
For build-only verification, dispatch Deploy Pages on the source branch with **data_ref** set to that
test data branch. Main deployments always use `data`, regardless of the input.

Every dataset manifest entry has a content-addressed `version`, ISO `generatedAt`, `sha256`, `bytes` and
`source`. Publishers update dates for fetched datasets even when the content is unchanged, and preserve
untouched sibling dates (including tags when their fetch fails). Older hash-only publications are validated
and upgraded using their stable Git commit time, explicitly labelled as a legacy publication timestamp;
repeated deploys never make them look newer. New rebuilds replace that legacy metadata with fetch time.
Committed fallbacks initially use extraction time, not an inferred upstream generation date.

The browser revalidates the manifest first, then fetches each dataset with `?v=<sha256>`. The footer shows
the card and win-rate dates; card data older than 14 days adds quiet footer text and a console warning.
Do not regenerate the manifest merely to silence a stale warning: run the relevant refresh pipeline.
`node scripts/generate-data-manifest.mjs` bootstraps committed snapshot metadata and chart-only deck metadata,
preserving dates of byte-identical snapshots. Both extraction scripts also write manifest entries.

See GitHub's [token-trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)
and [`workflow_run` documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run).

## Build contents and URL parity

The Vite `page-html` plugin keeps the artwork and the favicon, inlines the theme pre-paint script and
substitutes the bundled `src/main.ts` URL. Vite copies `public/` verbatim too, including the fallback datasets. The files used by the branch-served site
are preserved at the same relative URLs under `/PodMates/`:

| Before (repository root) | Source now                     | Build output                 |
| ------------------------ | ------------------------------ | ---------------------------- |
| `index.html`             | `index.html`                   | `dist/index.html`            |
| `manifest.webmanifest`   | `public/manifest.webmanifest`  | `dist/manifest.webmanifest`  |
| `apple-touch-icon.png`   | `public/apple-touch-icon.png`  | `dist/apple-touch-icon.png`  |
| `icon-192.png`           | `public/icon-192.png`          | `dist/icon-192.png`          |
| `icon-512.png`           | `public/icon-512.png`          | `dist/icon-512.png`          |
| `icon-maskable-512.png`  | `public/icon-maskable-512.png` | `dist/icon-maskable-512.png` |

The manifest's three icon URLs, `start_url` and `scope` remain relative and byte-identical.
The bundled loader fetches `data/*.json` relative to the app base; the deployment assembly replaces
only `cards.json`, `tags.json` and `winrates.json`. The Firebase SDK is bundled
into `dist/assets/`; Firebase's Auth/Firestore services, Google Fonts, Scryfall art/API, Tesseract CDN assets, the deployed deck-sync Worker and
PriceScry's raw `pricescry-data` branch URLs remain external; they are not part of `dist/`.
`deck-link-sync-worker.js` is Worker deployment source, not a browser-loaded script. Repository docs,
Firestore rules and data-builder scripts are not application assets.

To recheck before switching, run `npm ci`, `npm run check`, `npm run build` and `npm run e2e`.
Compare each `public/` file byte-for-byte with its `dist/` counterpart and with the corresponding
file on the branch-served `main`; compare `dist/index.html` with the checked-out source, not the
older `main` HTML. Check the HTML's `src`/`href`, CSS `url(...)`, runtime fetch/import URLs and the
manifest again whenever adding a new asset.

## Service worker, offline use and updates

`vite-plugin-pwa` generates `dist/sw.js` with Workbox `generateSW`. The existing manifest and icons are
reused unchanged. Only the shell, hashed JS/CSS and static icons are precached; datasets are never included
in the precache, so a weekly data-only deployment needs no SW rebuild.

`src/services/pwa.ts` registers relative to the app base with `updateViaCache: "none"`. The first dataset
request waits for initial SW control (at most five seconds); registration errors/timeouts warn and allow
ordinary online boot instead of blocking the site. No SW is installed in development. Existing sessions
show a dismissible **New version available / Reload / Later** banner; only clicking Reload sends
`SKIP_WAITING` and reloads that tab. Normal updates never reload a session automatically.

The manifest uses NetworkFirst with a three-second timeout and offline fallback, so a weekly hash is seen
on the next online visit. Dataset URLs use StaleWhileRevalidate with the full `?v=<sha256>` as the cache
key, a stable cache name across code releases and a 64-entry cap. The SW sends cached ETags explicitly
and reuses cached bodies on HTTP 304, even if the browser HTTP cache was cleared. Scryfall card images
alone use CacheFirst (250 images, 30 days).
There is **no catch-all runtime route**: Firestore, Auth, deck-sync Worker, Scryfall API and other external
requests are never SW-cached. The DB web worker script is excluded too; offline boot uses the existing
main-thread decoder. Online boot keeps the web worker.

Once a deck has been charted online, repeat visits can boot and chart using the cached DB, analysis data
and code. Unvisited lazy features, uncached card art and cloud operations still require a connection.
Browser storage eviction or cleared site data removes offline availability. Browser tests use a fresh
profile, the real build at `/PodMates/`, and a disconnected server (not just mocked dataset responses).

### Emergency kill-switch

Never remove `sw.js` or return an HTML 404 at that URL: old clients may remain controlled. In a reviewed
recovery deployment, build and assemble data normally, then **before uploading `dist/`** replace only
the emitted worker:

```powershell
Copy-Item scripts\sw-kill-switch.js dist\sw.js
```

Commit that temporary copy step into the deployment workflow in the recovery PR so subsequent automated
deployments do not immediately restore the broken worker. Serve the replacement at the **same**
`/PodMates/sw.js` URL with JavaScript MIME type. Keep it deployed long enough for returning clients to
receive it. It skips waiting, deletes only PodMates runtime caches and this scope's Workbox precache,
then unregisters itself. It has no fetch handler and never navigates open tabs. No account data,
localStorage or unrelated apps' caches are removed.

Verify in a previously controlled browser: registration disappears, PodMates caches disappear, ordinary
online reload reaches DB-ready, and offline navigation is no longer available. A browser e2e covers the
unregistration, cache isolation and lack of forced reload. For immediate individual recovery use browser
DevTools → Application → Service Workers → Unregister, then clear the app's Cache Storage and reload
online. Removing registration alone does not clear local saved decks.

### Bundle budget and the plan target gap

Run `npm run build && npm run budget`. CI runs it on every PR; deployment repeats the budget **after**
assembling published datasets, so weekly growth cannot bypass the gate. The script gzips every emitted
JS/CSS file plus the full HTML (including its inline CSS and artwork), and adds the eight eager boot datasets
and their manifest. Counting all chunks, including lazy chunks and the uncached worker, is conservative.
Missing inputs fail rather than being counted as zero.

The interim gates are **code <750,000 gzip bytes** and **code + boot data <3,500,000 gzip bytes** (decimal
MB). **These are not the plan §10 target of <1,500,000 bytes.** The pinned `cards.json` alone is 2,213,592
gzip bytes and the eager Spellbook is another 377,778; caching cannot make that first download smaller.
The script prints the measured total and exact gap on every run. Meeting §10 requires a separately agreed
card/Spellbook payload or loading redesign, not an unexplained relaxed definition of "initial".

The PWA e2e reports first-install and update gzip response-body bytes with a gzip/ETag local server.
First install includes icons, shell precaching and duplicate initial uncontrolled requests; it is larger
than the budget's JS/CSS + boot-data metric. A code-change test builds a genuinely changed `main` chunk
without editing source, verifies that unchanged chunks and dataset bodies are not transferred, and
requires explicit Reload. The changed HTML shell and SW update machinery also transfer while the legacy
HTML still embeds code. Headers/TLS and fulfilled external art are excluded; these are reproducible local
measurements, not a claim about production CDN transfer or rollout.

## Switch Pages to GitHub Actions (human)

1. Merge through checkpoint A after green CI and review. Do not switch while the workflows and
   `public/` assets exist only in a stacked branch.
2. Before switching, run **Actions → Deploy Pages → Run workflow**, select `main`, and leave
   **deploy** unchecked. Confirm the build succeeds and inspect the `github-pages` artifact.
   This exercises the build/upload path without publishing or requiring a Pages source change.
3. Open **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
   Do not change the site URL or custom-domain settings.
4. Run **Deploy Pages** on `main` with **deploy** checked. If the `github-pages` environment
   requires approval, approve it; its deployment branch policy must allow `main`.
5. Confirm the deployment URL, DB-ready indicator, Try a Deck chart, manifest and icons. Then
   confirm a successful weekly rebuild is followed by a successful **Deploy Pages** run.

A production deployment before step 3 can fail because Pages still uses its legacy source; it does
not switch the source automatically. Branch protection and any bot push exemptions remain human
administration tasks.

## Roll back to Deploy from branch (human)

First disable **Deploy Pages** in Actions so later pushes or rebuild completions cannot compete with
the rollback. In **Settings → Pages**, change Source to **Deploy from a branch**, select `main`
and **/ (root)**, then save. This restores the original branch-based publishing mechanism.

The tooling session moved the five static assets into `public/`. Before or alongside this rollback,
restore those files to the repository root in a reviewed recovery PR (keep `public/` intact):

```powershell
Copy-Item public\manifest.webmanifest, public\apple-touch-icon.png, public\icon-192.png, public\icon-512.png, public\icon-maskable-512.png .
```

Without those root copies, branch publishing serves the HTML but its manifest and icons return 404.
Do not roll back by replacing `index.html` with an old download: that can revert current bot data.
If rolling back an application bug rather than the publishing mechanism, use the one-tap rollback above
and `git revert` the offending commit on `main`. With branch publishing, wait for the branch Pages build and recheck the live URLs. To return to Actions,
repeat the switch procedure and re-enable **Deploy Pages**.

## Verification boundary

The implementation PR records the actual local checks and its own CI result. Until the workflows
land on the default branch, GitHub does not expose their new `workflow_dispatch` or `workflow_run`
triggers normally. A local production build and PR CI do **not** prove Pages publication, environment
approval/policies, or weekly cross-workflow triggering. The human build-only dispatch, first publish
and first rebuild-to-deploy checks above are required rollout evidence; no production settings
should be changed merely to validate this PR.

The CI deploy gate (p6-1) was verified on its first merge: the merge commit's `CI` run started Deploy Pages,
whose Summary said "Deploy gate: deploying 5c85862 … CI passed on main". Auto-merge and Update Snapshots only run
once they are on `main`. Their first real use is the next session (R17): check that its `ccr-` branch is merged,
CI runs on `main` and Deploy Pages follows. A `CI` run dispatched with the Actions token may or may not also start
Deploy Pages through `workflow_run`; Auto-merge dispatches Deploy Pages itself, so at worst a commit deploys twice.
