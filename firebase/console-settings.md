# Firebase console settings (project `podmates2027`)

What the live Firebase project is configured with, as read from the console by the owner. Nothing here is a
secret. The console is the source of truth; update this page when a setting changes there. Sessions never
change console settings.

## Authentication (checked 2026-11-13)

**Sign-in providers enabled:** Email/Password, Google, Yahoo.

These match the code exactly (`src/services/cloud/auth.ts`): `createUserWithEmailAndPassword`,
`signInWithEmailAndPassword` and `sendPasswordResetEmail`; `signInWithPopup` with `GoogleAuthProvider` and
`OAuthProvider("yahoo.com")`. Anonymous sign-in is **not** enabled, and the app never calls it: visitors start
signed out and can chart decks without an account. A provider the code uses but the console lacks fails with
`auth/operation-not-allowed` ("This sign-in method is not switched on yet.").

**Authorized domains** (where sign-in pop-ups may open):

| Domain                         | Type    | Why                                      |
| ------------------------------ | ------- | ---------------------------------------- |
| `localhost`                    | Default | `npm run dev` / `preview` and e2e        |
| `podmates2027.firebaseapp.com` | Default | Firebase's auth handler domain (pop-ups) |
| `podmates2027.web.app`         | Default | Firebase Hosting default (unused)        |
| `anf1978.github.io`            | Custom  | The live site on GitHub Pages            |

If the site ever moves to another domain, add it here first, or Google/Yahoo sign-in fails there with
`auth/unauthorized-domain`.

## Firestore indexes (checked 2026-11-13)

Automatic single-field indexes at their defaults, no exemptions, no composite indexes. Recorded in
[`firestore.indexes.json`](firestore.indexes.json). See [coverage.md](coverage.md#indexes-and-deployment).

## Not recorded yet

Sign-up quota, password policy, email templates (used by password reset) and Firestore rules deployment
history. [`firestore.rules`](firestore.rules) is the versioned copy of the rules; this repo never deploys it.
