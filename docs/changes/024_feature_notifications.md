# 024: Notifications (the in-app bell)

Date: 2026-11-12

## Summary

The bell at the top of the page shows what happened in your pods: a podmate charted a new deck, set up or started
a Gathering, invited you, replied to your invite, cancelled, joined a pod or nominated an Impact card. A badge counts
what is new since you last looked. You can switch off kinds of notice and mute pods. It only works inside the site:
PodMates never sends emails or push notifications.

## What users see

- **Bell** (`#pmBellBtn`) at the start of the account bar, with a badge (`#pmBellBadge`, "9+" above nine) and an
  accessible label "Notifications, N new".
- **Inbox dialog**: newest first across all your pods, the last 30 days, your own activity and notices addressed to
  others left out; rows new since last opened are highlighted. Tapping a Gathering notice opens that Gathering;
  others open the pod.
- **Settings** (collapsible): a checkbox per kind ("A podmate charts a new deck", "A gathering is set up", "A gathering
  goes live", "Someone nominates an Impact card", "You are invited to a gathering", "Someone replies to your invite",
  "A gathering is cancelled", "Someone joins a pod") and a mute per pod.
- The first time on a device, everything before that moment counts as already seen.

## How it works

- `index.ts`: `mount(bar)` returns `NotificationsFeature` (`open`, `restart`, `unread`, `destroy`). It subscribes to
  each pod's activity feed, merges them, keeps the badge current and redraws the open dialog. Auth changes clear the
  old account's state at once; a version counter ignores superseded pod loads and stale feed callbacks. Membership
  changes (`pods:membership`) restart the subscriptions, debounced. A guest's unsaved toggles survive auth settling.
- `state.ts`: `TYPES` (labels, tags, texts), pure filtering (`visible`: muted pods, disabled types, 30 days, own,
  addressed `to`), `unreadCount`, `ago`, `opensGathering`. `storage.ts`: guarded local storage reads/writes.
- `view.ts`: bell and inbox templates (names and subjects escaped). `notifications.css`, prefix `pm-notif-`.

Wiring: `src/main.ts` mounts it on `#authBar` after the app modules and error handlers. No ports.

Events: listens to `pods:membership` (emitted by the pod repository after create/join/leave/remove/delete); emits
`gatherings:open` and `pods:open` to navigate.

Data:

- Firestore (`src/services/cloud/activity.ts`; names exact): reads `pods/{podId}/activity` (newest 30 by
  `createdAt`) = `type`, `by`, `byName`, `subject`, `createdAt`, `ref?`, `to?`. Other features write it
  (`logActivity` / `notify`: saved decks, pods, Gatherings, Impact). The bell writes nothing to Firestore.
- Local storage, per account: `pm_notif_seen_<uid>` (the seen cutoff) and `pm_notif_prefs_<uid>` (`{ types, muted }`).
  Storage and feed failures report and never block the page.

## Testing

- Unit: `notifications.test.ts` (merge order, exclusions, 30-day boundary, seen cutoff, relative times),
  `lifecycle.test.ts` (badge, seen, escaping, saved opt-outs, guest toggles, routing events, debounced membership,
  account changes, stale loads, corrupt storage and failures).
- e2e: `notifications.spec.ts` (dialog, settings and Escape lifecycle, offline, no cloud writes).
- By hand: with two accounts in a pod, have one save a deck; the other sees the badge, opens the bell, mutes the pod.

## Risks and rollback

Display only; missed notices cost nothing. Roll back with `git revert`.

## Follow-ups

None.

## Related

`004`, `012`, `015`, `016`, `018` (features that write activity), `013` (account changes).
