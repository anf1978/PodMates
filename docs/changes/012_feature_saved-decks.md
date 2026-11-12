# 012: Saved Decks (Save, Load a Deck, Build Table)

Date: 2026-11-12

## Summary

Saved Decks keeps your decks in your PodMates account. **Save Deck** stores the deck in the form (or links it to
Archidekt/Moxfield so it stays in sync), **Load a Deck** brings back your own decks and the ones your podmates share,
and **Build Table** (on the MyPods tab) scores all of them side by side. Decks are visible to your pods unless you
mark them secret. Saving needs an account; a signed-out visitor is asked to sign up first.

## What users see

- **Save Deck** (`#saveDeckBtn`) with the **secret** checkbox (`#deckSecretCheckbox`), Deck Chart tab. Needs a list,
  a commander and a player ("two decks sharing a commander would otherwise silently overwrite each other"). If the
  name is taken: dialog "Deck name already in use" with **Overwrite Existing** / **Save as New Deck** (adds a
  suffix). With "keep synced" ticked after an import (`006`), it links instead: "Saved and linked as …".
  Messages appear in `#deckMgmtStatus`.
- **Load a Deck** (`#loadDeckBtn`): a dialog listing your decks and podmates' shared ones, a search box, player
  chips to filter, a linked badge, a secret toggle and delete (with confirmation) on your own decks. Tapping a row
  fills the form (Deck Name counts as chosen) and pulses Chart Deck. A retry notice shows if some lists failed.
- **For a Gathering seat** (`decks:pick`): the same dialog titled "… — Seat N (name)", pre-filtered to that podmate
  when it is someone else's seat; tapping writes the deck into the seat and reopens the Gathering.
- **The Full Ledger → Build Table** (`#buildSavedDecksTableBtn`, MyPods tab): a sortable table of every saved and
  shared deck with scores (shared `src/ui/decks-table.ts`).

## How it works

- `index.ts`: `mount(ports)` binds the three buttons and a document click delegate, listens to `decks:save` (Deck
  Crafter) and `decks:pick` (Gatherings), refreshes on auth change, and warms the deck caches when the app becomes
  visible, regains focus, comes back online or is restored from the back/forward cache (at most every 15 s).
- `save.ts`: validation, the name-collision choice and the write; `load-deck.ts` + `load-deck-view.ts`: the dialog,
  filters, secret toggle, delete and seat handoff; `table.ts`: Build Table; `form.ts`: form field and status
  helpers; `ports.ts`: the configured ports. `saved-decks.css`.
- `src/services/saved-decks.ts` holds the cached lists (yours, and podmates' keyed `pm:{uid}:{key}`), shared with My
  Profile and player profiles. `services/deck-rows.ts` and `services/linked-duplicates.ts` score rows and drop a
  linked deck's duplicate.

Ports (`SavedDecksPorts`, from `src/app/saved-decks.ts`): `ready` (card DB), `analyze` (`app/analysis.ts`),
`requireAccount` (auth's `requireAccountToSave`), `nameChosen` and `importedUrl` (`services/deck-form`).

Events: listens to `decks:save` and `decks:pick`; emits `gatherings:open` after filling a seat.

Data (Firestore, via `src/services/cloud/`; names exact):

- `users/{uid}/decks/{id}` (`decks.ts`): `key`, `commander`, `player`, `list`, `deckName`, `savedAt`, `secret`,
  `updatedAt`. The id is the encoded deck name, or `linked-{platform}-{deckId}` for a linked deck's mirror. A new,
  non-secret deck logs a `deck` activity for the pod feed. Cap: `PM_LIMITS.maxSavedDecks`.
- `users/{uid}/linkedDecks/{id}` (`linked-decks.ts`): `platform`, `deckId`, `url`, `name`, `commander`,
  `decklistText`, `cardCount`, `addedAt`, `syncedAt`. Cap: `PM_LIMITS.maxLinkedDecks`.
- Podmates' decks are read from each member's `users/{uid}/decks` across every pod you are in (`loadMyPods`,
  `loadPodMembers`); secret ones are excluded.
- Seat handoff: `pods/{podId}/gatherings/{gatheringId}` field `seats.{index}.deck` = `{ commander, list,
cardCount }`, plus `updatedAt`.

No local storage.

## Testing

- Unit: `saved-decks.test.ts` (list, filter and load into the form; seat pick pre-filtered to the podmate;
  overwrite-or-new choice; missing-field messages), repository tests in `src/services/cloud/repositories.test.ts`.
- e2e: `saved-decks.spec.ts` "Save, Load a Deck and Build Table guide a signed-out visitor" (offline, no account).
- By hand: sign in, chart a sample with a player name, Save; Save again (collision dialog); Load a Deck, toggle
  secret, load it back; on MyPods, Build Table.

## Risks and rollback

These are real user documents: never change the paths or field names. A code revert does not undo decks written
or deleted meanwhile. Roll back with `git revert` or Deploy Pages with an older `ref`.

## Follow-ups

- `ports.ts` still says "what Saved Decks needs from the page that is not a typed module yet"; everything it names is
  typed now (stale comment).

## Related

`004`, `006` (imported link, keep synced), `010` (Deck Crafter's Save), `013` (auth's save guard), `014` (My
Profile uses the same lists), `016` (Gathering seats).
