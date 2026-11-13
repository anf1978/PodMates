# 031: Confirm the deck-sync Worker source matches what is deployed

Date: 2026-11-13

## Summary

The small Cloudflare server that imports decks from Archidekt and Moxfield had its code copied into the repo
on Nov 10, but nobody had checked that the copy matched what was actually running. The owner compared them in
the Cloudflare dashboard, and they match. The docs now say so, and they drop two outdated claims: that the
Worker source is missing, and that the app has no service worker.

## What users see

Nothing.

## How it works

- `docs/overview.md` §3.7: the Worker source is `deck-link-sync-worker.js` and was confirmed against the
  deployed code on 2026-11-13. Only its deployment lives outside the repo. The missing-script list now names
  the three still-missing builders (the staples/mana-base baselines are rebuildable since 020).
- `docs/overview.md` §1: the app has a Workbox service worker (`src/services/pwa.ts`); the old "no offline
  mode" line was out of date.
- `docs/architecture.md`: records the confirmation, and that changing the file means pasting it into
  Cloudflare by hand.
- No code or data changes.

## Testing

Docs only; the change-doc test passes.

## Risks and rollback

None. If someone edits the Worker in the Cloudflare dashboard without updating the file, the two drift
apart again. Undo with `git revert <sha>`.

## Follow-ups

None.

## Related

020, 029, 030 (same audit of missing pieces).
