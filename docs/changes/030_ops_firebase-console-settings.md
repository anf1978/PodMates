# 030: Record the Firebase sign-in settings

Date: 2026-11-13

## Summary

How the live Firebase project handles sign-in was only in the owner's head. The owner read it from the Firebase
console, and it is now written down in `firebase/console-settings.md`: which sign-in methods are on (email and
password, Google, Yahoo) and which website addresses may open the sign-in pop-ups. It matches what the app's
code uses. The docs also stop claiming that visitors are signed in anonymously, which hasn't been true for a while.

## What users see

Nothing.

## How it works

- New `firebase/console-settings.md`: providers Email/Password, Google and Yahoo (anonymous off); authorised
  domains `localhost`, `podmates2027.firebaseapp.com`, `podmates2027.web.app` (defaults) and
  `anf1978.github.io` (custom); the index state from 029. Each provider is mapped to the calls in
  `src/services/cloud/auth.ts`, and the page lists the errors a mismatch would cause.
- `docs/overview.md` §2.3: visitors start signed out (the code has no `signInAnonymously`, and the console has
  the provider off). §3.4/§3.7 point to the new page.
- `firebase/CLAUDE.md` and the `CLAUDE.md` Map link it.
- No code, Firestore paths, rules or data change.

## Testing

Docs only; `npm run check` (change-doc test) passes. The provider list was compared with `src/services/cloud/auth.ts`.

## Risks and rollback

None. The page can go stale if console settings change; it says to update it. Undo with `git revert <sha>`.

## Follow-ups

- Not yet recorded: sign-up quota, password policy and email templates.
- The Cloudflare Worker: compare the deployed code with `deck-link-sync-worker.js` (needs Cloudflare access).

## Related

029 (indexes), 020 (same audit of missing pieces).
