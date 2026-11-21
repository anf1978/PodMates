# 048: Deck notes rules published in the Firebase console

Date: 2026-11-22

## Summary

The owner pasted the updated Firestore rules from change 047 into the Firebase console on 22 November 2026.
Deck notes and after-battle Spark checks now work on the live site.

## What users see

- In **View Deck**, the owner of a saved deck sees the Deck Primer box and a note button on each card, and can
  save both. Podmates see the primer and the notes.
- Answers to the after-battle Spark question are saved, and the deck's Deck Log shows **Against its Spark**.

## How it works

- No code change. `firebase/console-settings.md` records the publish date; `firebase/coverage.md` no longer calls
  the deck notes rules pending. The console now matches `firebase/firestore.rules`.

## Testing

- Docs only. The rules themselves are covered by `firebase/rules.test.ts` → `deck notes and Spark checks` and
  by `firebase/limits.test.ts` (change 047).
- By hand: load a saved deck and open View Deck. Write a primer and a card note, then close and reopen View
  Deck. Both are still there.

## Risks and rollback

None from this change. To roll the rules back, paste the previous version from git history into the console.

## Follow-ups

None.

## Related

047 (deck notes), 039 (the previous rules publish), 030 (console settings).
