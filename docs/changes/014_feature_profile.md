# 014: My Profile and public player/pod profiles

Date: 2026-11-12

## Summary

My Profile is your account page: your display name, links to your Archidekt and Moxfield profiles, every deck you
have saved or linked (with a quick score preview), a scored table, display settings, a backup of your saved decks
and the door to PriceScry. The same feature also draws the **public profiles** your podmates see: a player's or a
pod's decks, colours, card types, bracket spread and play style, worked out from their shared decks and Chronicles.

## What users see

- **My Profile** (account bar button, or right after a new sign-in in welcome mode "Welcome! Set up your
  profile"): your public header, sign-in details, **Display name** + **Save Name** (refused if someone in one of your
  pods already uses it), profile links, **Add Deck** from an Archidekt/Moxfield link, **Show my decks** (saved and
  linked decks merged, each with refresh/remove and a quick summary; tap to chart it), **Build Table**, **Display
  settings — colour themes** (`025`), **Backup & Restore** and a **PriceScry** button. Welcome mode offers "Skip for
  now".
- **Player profile** (from a pod's member list) and **Pod profile** (from a pod): header, Player/Pod Type (Timmy,
  Johnny, Spike… from table vibes), colour and card-type pies, bracket distribution, archetype table, a deck
  scatter you can tap to chart a deck (with a confirm), and the owner's secret-deck count without analysing them.

## How it works

- `index.ts`: `mount()` listens to `profile:open`, `profile:pod`, `profile:player`; `showProfileModal(options)`
  builds My Profile and binds its controls (ignores a load that finishes after the dialog closed).
- `decks.ts` (`loadAndMergeMyDecks`: saved + linked, repairs a missing linked mirror best-effort), `state.ts` (pairs
  linked mirrors by document id, not display name), `deck-list.ts` (rows and actions), `summary.ts` (in-memory quick
  summaries via the engine), `account.ts` (sign-in box, editable links), `backup.ts`, `table.ts`, `view.ts`.
- Public profiles: `public-view.ts` (overlays), `public-data.ts` (decks, members, Chronicles), `public-analytics.ts`
  (breakdowns, vibe trait, colours per owner), `public-charts.ts`, `public-sections.ts`, `public-types.ts`.
- CSS: `profile.css` (prefix `profile-`) and `public-profile.css` (prefix `pp-`).

Ports: `ProfileRuntime` (`runtime.ts`) and `PublicProfileRuntime` (`public-runtime.ts`), both from
`src/app/profile.ts`: overlays and confirms, card DB, engine context and indexes, `safeUrl`, `buildTable`
(`ProfileTableRuntime` over the shared decks table), `displaySettings` (themes' `mount`), `requireAccount` (auth),
`priceScry` (emits `pricescry:open`), `podId` (`app/active-pod`), saved-deck lists, `analyzeOneList`
(`app/analysis`), card art, `chartDeck` (fills the form, switches to Deck Chart, charts) and `POD_COLORS`.

Events: listens to `profile:open` (auth), `profile:pod` and `profile:player` (pods); emits `pricescry:open`.

Data (Firestore via `src/services/cloud/`, names exact):

- Reads `users/{uid}/decks` and `users/{uid}/linkedDecks` (`012`); podmates' shared decks (`loadPodmateDecks`),
  `pods/{podId}/members` and the pod's Chronicles (`loadAllChronicles`) for public profiles.
- Display name: Firebase Auth profile, then `pods/{podId}/members/{uid}` field `displayName` in every pod.
- Links: `users/{uid}` fields `archidektProfileUrl`, `moxfieldProfileUrl` (http(s) only, `PM_LIMITS.profileUrl`).
- Add Deck writes a linked deck and its mirror (`012`). Restore writes saved decks back.
- Backup file: `podmates-backup-YYYY-MM-DD.json` = `{ type: "podmates_backup", version: 1, exportedAt, decks }`,
  saved decks only (linked decks have a live source elsewhere).

No local storage of its own (the themes tray uses its own keys, `025`).

## Testing

- Unit: `profile.test.ts` (mirror pairing, backfill, timestamps), `lifecycle.test.ts` (routing to public profiles,
  name/link saves, add failures, escaping, no render after close), `public-profile.test.ts` (type/colour pies, vibe
  trait, brackets, owner colours, secret decks excluded, member attribution, scatter confirm).
- e2e: `auth-profile.spec.ts` (profile's account form signed out), `accessibility.spec.ts` (account screens).
  Signed-in profiles are not covered by e2e (no live account in CI).
- By hand: sign in, open My Profile, change the display name, add a deck link, expand Show my decks and tap one,
  download a backup. From MyPods, open a pod's profile and a member's.

## Risks and rollback

Name changes and restores write real documents; a revert does not undo them. Roll back code with `git revert`.

## Follow-ups

- `public-runtime.ts` says "Capabilities still owned by the page"; they are app ports now (stale comment).

## Related

`004`, `012` (deck lists), `013` (welcome flow, save guard), `015` (pods open profiles), `017` (Chronicles feed the
public analytics), `025` (Display settings), `026` (PriceScry).
