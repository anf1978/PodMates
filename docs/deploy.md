# Deploying PodMates

The site stays at <https://anf1978.github.io/PodMates/>. Switching the Pages source is a human-only
step; adding these workflows does not change the repository's Pages settings.

## CI and deployment

`.github/workflows/ci.yml` runs on every pull request, including stacked PRs targeting another branch,
and on pushes to `main`. It uses Node 22, cached npm downloads, `npm ci`, `npm run check` (types, lint,
unit and golden tests), then Playwright Chromium against a production build. Failed browser tests
upload a seven-day `playwright-report` artifact.

`.github/workflows/deploy.yml` builds with Node 22 and Vite, uploads **only `dist/`** as the
`github-pages` artifact, then publishes with `actions/deploy-pages`. The deployment job alone gets
`pages: write` and `id-token: write`; builds get `contents: read`. The `pages` concurrency group
serializes runs without cancelling a deployment in progress. Actions are pinned to major versions;
SHA pinning is deferred to p5-2.

Pushes to `main` deploy automatically. Manual runs build by default without publishing; publishing
requires selecting `main` and enabling the **deploy** input. A manual run on any other branch cannot
publish even if that input is enabled. No PR-preview hosting environment is created here.

### Weekly data refreshes

The card and commander win-rate rebuilds push `index.html` using `GITHUB_TOKEN`. Those pushes **do
not trigger `push` workflows**. Instead, deployment listens for successful `workflow_run` completion
of `Rebuild Card Database` and `Rebuild Commander Win-Rate Database`, restricted to runs on `main`.
Failed rebuilds do not deploy; a successful no-change rebuild can harmlessly redeploy.

The downstream checkout explicitly uses the latest `main`, not the upstream run's `head_sha`, which
predates the bot's new commit. This includes the freshly spliced data. No PAT, additional secret or
write permission on the rebuild token is needed. Both workflow files must first be on the default
branch for this trigger to work. Keep the workflow names in sync if renaming either rebuild.

See GitHub's [token-trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)
and [`workflow_run` documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run).

## Build contents and URL parity

The interim Vite plugin copies `index.html` verbatim, preserving inline scripts, embedded card data,
artwork and the favicon. Vite copies `public/` verbatim too. The files used by the branch-served site
are preserved at the same relative URLs under `/PodMates/`:

| Before (repository root) | Source now                     | Build output                 |
| ------------------------ | ------------------------------ | ---------------------------- |
| `index.html`             | `index.html`                   | `dist/index.html`            |
| `manifest.webmanifest`   | `public/manifest.webmanifest`  | `dist/manifest.webmanifest`  |
| `apple-touch-icon.png`   | `public/apple-touch-icon.png`  | `dist/apple-touch-icon.png`  |
| `icon-192.png`           | `public/icon-192.png`          | `dist/icon-192.png`          |
| `icon-512.png`           | `public/icon-512.png`          | `dist/icon-512.png`          |
| `icon-maskable-512.png`  | `public/icon-maskable-512.png` | `dist/icon-maskable-512.png` |

The manifest's three icon URLs, `start_url` and `scope` remain relative. There is no local service
worker or other local script, stylesheet or runtime dataset URL to copy at this stage. Firebase CDN
modules, Google Fonts, Scryfall art/API, Tesseract CDN assets, the deployed deck-sync Worker and
PriceScry's raw `pricescry-data` branch URLs remain external; they are not part of `dist/`.
`deck-link-sync-worker.js` is Worker deployment source, not a browser-loaded script. Repository docs,
Firestore rules and data-builder scripts are not application assets.

To recheck before switching, run `npm ci`, `npm run check`, `npm run build` and `npm run e2e`.
Compare each `public/` file byte-for-byte with its `dist/` counterpart and with the corresponding
file on the branch-served `main`; compare `dist/index.html` with the checked-out source, not the
older `main` HTML. Check the HTML's `src`/`href`, CSS `url(...)`, runtime fetch/import URLs and the
manifest again whenever adding a new asset.

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
If rolling back an application bug rather than the publishing mechanism, revert only the offending
code commit in a PR. Wait for the branch Pages build and recheck the live URLs. To return to Actions,
repeat the switch procedure and re-enable **Deploy Pages**.

## Verification boundary

The implementation PR records the actual local checks and its own CI result. Until the workflows
land on the default branch, GitHub does not expose their new `workflow_dispatch` or `workflow_run`
triggers normally. A local production build and PR CI do **not** prove Pages publication, environment
approval/policies, or weekly cross-workflow triggering. The human build-only dispatch, first publish
and first rebuild-to-deploy checks above are required rollout evidence; no production settings
should be changed merely to validate this PR.
