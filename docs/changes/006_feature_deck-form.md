# 006: Deck form controls (Clear, Deck Name, link import)

Date: 2026-11-12

## Summary

The deck form is the box at the top of the Deck Chart tab where you paste a decklist and type the commander, player
and deck name. This small feature owns three of its controls: the **Clear** button, the automatic Deck Name
("Commander (Player)") and **Import Deck**, which pulls a deck from an Archidekt or Moxfield link. The other buttons
next to the list belong to their own features (Chart Deck `005`, View Deck `011`, Export `008`, Try a Deck `007`,
Scan `009`, Deck Crafter `010`, Save/Load `012`).

## What users see

On the **Deck Chart** tab, panel "Your Decklist":

- **Commander**, **Player**, **Deck Name**: while Deck Name is empty or untouched it follows the other two as
  `Commander (Player)`. Typing your own name stops that; clearing it resumes it.
- **Deck link** (`#deckLinkInput`) + **Import Deck** (`#deckLinkLoadBtn`): fills the list, commander and the
  platform's deck name, then shows "Loaded “name” — N cards …" and a **keep synced with Archidekt/Moxfield**
  checkbox (`#deckLinkSyncOption`), which Save uses (`012`). Errors show in `#deckLinkStatus`.
- **Clear** (`#clearBtn`): empties list, commander, player and name, hides the results and the sync option.

## How it works

- `src/features/deck-form/index.ts` (the only file): `mount()` binds Clear, the Commander/Player/Deck Name `input`
  listeners and Import Deck. No ports; `src/app/page.ts` calls `mountDeckForm()` during page boot, before any other
  feature wiring, so its listeners stay first.
- `src/services/deck-form.ts` holds the shared form state other features read or set through their ports:
  `deckNameChosen` / `setDeckNameChosen`, `autoFillDeckName`, `resetDeckName`, `importedDeckUrl` /
  `setImportedDeckUrl` and `fillDeckForm` (used by Try-a-Deck, profiles, Deck Crafter and Saved Decks).
- Import calls `fetchDeckByLink(url)` in `src/services/cloud/linked-decks.ts`, which fetches
  `SYNC_WORKER_URL?deckUrl=<url>` (the Cloudflare Worker `deck-link-sync-worker.js`; Archidekt and Moxfield do not
  allow browser requests directly). Failures report as operation `deck-sync`.
- Field length caps come from `PM_LIMITS` via `src/app/input-limits.ts`.

Events: none. Data: no Firestore writes and no local storage; the imported link lives in memory until Save or Clear.
The Worker's limits (GET only, known origins, HTTPS deck paths, 10 s timeout, 2 MiB cap) are in
`docs/architecture.md`.

## Testing

- Unit: no test file in the folder. `src/services/cloud/repositories.test.ts` checks the Worker URL that
  `fetchDeckByLink` builds; `saved-decks.test.ts` covers Save's use of the imported link.
- e2e: `deck-crafter.spec.ts` uses the form fields; e2e runs offline, so the real link import is not covered.
- By hand: type a commander and player and watch Deck Name fill; type your own name and change the commander (name
  stays). Paste a public Archidekt or Moxfield link, press Import Deck, check the list and name; press Clear.

## Risks and rollback

If the Worker is down or the platforms change their API, Import shows "Could not reach the sync service" or the
Worker's error; nothing else breaks. The Worker is deployed separately from the site (its source in the repo is
`deck-link-sync-worker.js`). Roll back the site with `git revert` or Deploy Pages with an older `ref`.

## Follow-ups

- No unit test covers Clear or the auto-naming rules (`services/deck-form.ts`).
- Unclear: whether the deployed Worker matches `deck-link-sync-worker.js` in the repo. The Worker source is listed as
  a piece to recover in `docs/refactor-plan/00-README.md`; a human with Cloudflare access would need to confirm.

## Related

`004`, `005`, `012` (Save uses the imported link for "keep synced").
