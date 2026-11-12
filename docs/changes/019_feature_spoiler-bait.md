# 019: Spoiler Bait (swipe on new cards)

Date: 2026-11-12

## Summary

Spoiler Bait shows the newest Magic cards (spoilers and releases from the last ten days) one at a time, and you
swipe or tap **Bang** (want it) or **Bin** (not for me). Your votes are saved to your account; the pod board ranks
the cards your podmates banged most. It lives in two places: a pod's detail and the **Bait** tab of PriceScry.

## What users see

- **Entry points**: **Spoiler Bait — swipe on this week's new cards** in a pod's detail (dialog, pod board for that
  pod), and PriceScry's **Bait** tab (`026`; uses PriceScry's recorded spoiler signals and the active pod).
- **Signed out**: a sign-in gate; nothing loads.
- **The queue**: a card image with **💥 Bang** / **✕ Bin** buttons, swipe gestures and keyboard; undo the last vote;
  rarity filters (common/uncommon/rare/mythic; unknown rarities stay visible) with a note about hidden cards.
- **Bangers (N)** and **Binned (N)** lists: move a card to the other list or unsort it; in PriceScry, tapping a
  Banger opens its price history.
- **Pod board**: cards ranked by bangs, then fewer bins, then most recent, with voter names.

## How it works

- `index.ts`: `mount(host, options)` returns `{ ready, destroy }` (`mode: "pod" | "ps"`, `podId`, `signals`, `day`,
  `onOpen`); `openSpoilerBaitOverlay(pod)`; `connect()` subscribes to `spoilers:open` and `pods:active`. Votes are
  optimistic; a failed write shows a toast and reports. Replacing or dismissing the host retires pending renders,
  animation timers and global pointer listeners; an account switch stops further writes.
- `data.ts`: `fetchSpoilers()` queries Scryfall search
  `(is:spoiler or date>=<10 days ago>) -is:reprint game:paper`, newest spoiled first, at most three pages, cached in
  memory for 30 minutes; fills missing rarities via `/cards/collection` in batches of 75. `signalCards()` turns
  PriceScry's recorded signals into cards.
- `state.ts`: pure queue, rarity filters, vote map and board ordering. `gestures.ts`: swipe handling.
- `view.ts`: templates (names escaped). `spoiler-bait.css`, prefix `sb-`.

Wiring: `src/app/spoiler-bait.ts` calls `connect()`; `src/app/pricescry.ts` mounts the Bait tab with
`{ mode: "ps", podId: activePodId(), signals, day, onOpen }`. No ports object otherwise.

Events: listens to `spoilers:open` (Pods) and `pods:active`.

Data:

- Firestore (`src/services/cloud/spoiler-votes.ts`; names exact): `users/{uid}/spoilerVotes/{key}` = `key`, `n`,
  `setName`, `vote` (`"like"` = Bang, `"pass"` = Bin), `votedAt`, `updatedAt`. Undo deletes the document. The pod
  board reads every member's votes (`pods/{podId}/members`, then each `users/{uid}/spoilerVotes`).
- Scryfall API (search, collection, image redirects); PriceScry's spoiler signals in the Bait tab.
- Local storage `pm-sb-rarities`: the chosen rarity filters (JSON array).

## Testing

- Unit: `spoiler-bait.test.ts` (filters, board ranking), `data.test.ts` (signal dedup, three-page bound and cache,
  rarity batches), `lifecycle.test.ts` (votes, undo, move, unsort, escaping; rarity persistence; PriceScry signals
  and pod events; rejected writes; teardown; sign-in gate and account switch).
- e2e: `spoiler-bait.spec.ts` (PriceScry's signed-out gate, restored on reopen).
- By hand: signed in, open a pod → Spoiler Bait, Bang two cards and Bin one, undo, check Bangers; open the pod
  board with a second account's votes.

## Risks and rollback

Scryfall outages leave an empty queue; votes are only the user's own documents. Roll back with `git revert`.

## Follow-ups

None.

## Related

`004`, `015` (pod entry point), `026` (PriceScry's Bait tab).
