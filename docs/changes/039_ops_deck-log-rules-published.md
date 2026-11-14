# 039: Deck Log rules published in the Firebase console

Date: 2026-11-15

## Summary

The owner pasted the updated Firestore rules from change 038 into the Firebase console on 15 November 2026. The
parts of Deck Log that depended on them now work on the live site: podmates' views of a shared deck are counted,
and each deck's change log is saved and shown.

## What users see

- **Viewed by podmates** goes up when a podmate charts a shared deck.
- **Change Log** entries appear after saving a deck with different cards (saves before today made none).

## How it works

- No code change. `firebase/console-settings.md` records the publish date; `firebase/coverage.md` no longer calls
  the Deck Log rules pending. The console now matches `firebase/firestore.rules`.

## Testing

Docs only. The rules themselves are covered by `firebase/rules.test.ts` → `deck log` (change 038). By hand: change
a card in a saved deck, save, chart it, and open Deck Log. The change log lists the change with Spark before and
after.

## Risks and rollback

None from this change. To roll the rules back, paste the previous version from git history into the console.

## Follow-ups

None.

## Related

038 (Deck Log), 030 (console settings).
