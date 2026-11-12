# 013: Accounts (sign up, log in, sign out)

Date: 2026-11-12

## Summary

Accounts are optional: anyone can chart decks as a guest. Signing up (email and password, Google or Yahoo) lets you
save decks, join pods and use the social features. This feature owns the account bar at the top of the page, the
sign-up/log-in dialog with password reset, sign-out, and the "sign up to save" prompt other features show when a
guest tries to save something.

## What users see

- **Account bar** (`#authBar`): "Playing as guest" with **Sign In**, or "Signed in as <name>" with **My Profile**
  and **Sign Out**.
- **Sign-in dialog**: "Create an Account" (display name, email, password) or "Log In", a link to switch between them,
  **Forgot password?**, and **Google** / **Yahoo** buttons. Log In pre-fills the last email used on this device and
  says how you signed in last time ("Google" or "email and password"). Errors are friendly messages (wrong password,
  network, blocked pop-up inside in-app browsers…).
- Signing up with an email that already has an account logs you in instead ("Welcome back, … you already had an
  account"). A new account (or any Google/Yahoo sign-in) opens My Profile in welcome mode (`014`).
- **Sign Out** asks for confirmation, then "Signed out."
- **Save guard**: a guest pressing Save (decks, profiles, Chronicles…) sees "Sign up or log in to save … — using
  PodMates to chart decks stays free either way." and the dialog.

## How it works

- `index.ts`: `configureAuth(runtime)`, `mount()` (renders the bar, binds its buttons, listens to `auth:open`, and on
  every auth change updates the bar and the device hint), `showAuthModal()`, `updateAuthBar()` and
  `requireAccountToSave(what)`, which Saved Decks, profiles and Chronicles receive through their ports.
- `state.ts`: `rememberedSignIn` (parses the device hint; ignores corrupt data, caps the email at 200 characters) and
  `validateCredentials`.
- `view.ts`: the bar and dialog templates. Redraws clear the password fields on purpose. `auth.css`, prefix `auth-`.

Runtime (`AuthRuntime`, from `src/app/auth.ts`): `open` / `close` (the shared `tad-modal` overlay) and `confirm`
(`ui/confirm`).

Events: listens to `auth:open` (emitted by Pods' signed-out screen); emits `profile:open` (My Profile button, and
`{ welcome: true }` after a new sign-in).

Data:

- Firebase Authentication only, through `src/services/cloud/auth.ts` (`signUpWithEmail` sets the display name,
  clamped to `PM_LIMITS.displayName`; `logInWithEmail`, `signInWithGoogle`, `signInWithYahoo` pop-ups,
  `resetPassword`, `signOutUser`). Failures report as operation `authentication`. This feature writes no Firestore
  documents itself; `users/{uid}` is written by profile and pods code.
- Local storage `podmates_last_signin` = `{ email, providers }`: a browser-only hint, never sent to the error sink.

## Testing

- Unit: `auth.test.ts` (opens on `auth:open`; keeps the email but clears passwords; welcome only for new accounts;
  login email kept after a provider failure; escaped reset confirmation; malformed hints ignored).
- e2e: `auth-profile.spec.ts` (forms keep the email across modes, validation and reset; profile's optional account
  form leaves the deck form alone), `accessibility.spec.ts` (sign-up and log-in).
- By hand: Sign In → switch to Log In and back; try a wrong password; Forgot password? with your email; sign in with
  Google; Sign Out.

## Risks and rollback

A broken dialog stops sign-ins but not deck charting. Provider settings (Google/Yahoo enabled, authorised domains)
live in the Firebase console, not in the repo. Roll back with `git revert`.

## Follow-ups

None.

## Related

`004`, `012` (save guard), `014` (My Profile and the welcome flow), `015` (Pods' signed-out screen emits
`auth:open`).
