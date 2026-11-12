# 015: MyPods (create, join and run a pod)

Date: 2026-11-12

## Summary

A pod is a playgroup. On the **MyPods** tab you create a pod or join one with an invite link, see your pods and
their members, and open each pod's tools: hosting a Gathering, the pod profile and Spoiler Bait. The pod's Steward
(leader) and Co-Stewards manage the name, the invite link and members. Pods need an account; the tab invites guests
to sign in, and anyone can try a sample Gathering without one.

## What users see

On the **MyPods** tab (`#modePodBtn`, panel `#podMode > .panel`):

- **Signed out**: "Sign Up / Log In" (`#ourPodSignUpBtn`) and **Sample a Gathering**.
- **Landing**: your pods, live invitations to open Gatherings (cards painted by Gatherings, `016`), **Create a Pod**,
  **Join a Pod** (paste a link or a code) and **Sample a Gathering**.
- **Pod detail** (dialog): name, **Host a Gathering**, **View Pod Profile**, **Spoiler Bait — swipe on this week's new
  cards**, **Invite Link** + **Copy**, the members list (tap a name for their profile) with roles Steward /
  Co-Steward / Member. Stewards and Co-Stewards can rename the pod, make a new invite link, promote members, remove
  members; the Steward can hand over stewardship and **Delete Pod**. Everyone can leave.
- **Invite links** (`?join=CODE`): after sign-in a warning asks for explicit consent before joining; a declined
  invite is not retried. Joining is refused if the pod is full, you are in too many pods, or someone there already
  uses your display name.

## How it works

- `index.ts`: `mount(panel, ui)` returns `PodsFeature` (`renderPanel`, `openDetail`, `reopenDetail`,
  `getActivePodId`, `setActivePodId`, `destroy`). Landing, create/join forms, URL-invite consent and auth handling;
  a version counter ignores stale loads and unmount removes the overlay it owns.
- `detail.ts` (pod settings and buttons), `members.ts` (member actions), `live-invites.ts` (one subscription per
  pod for open Gatherings, disposed on redraw or when the landing leaves the page).
- `state.ts`: pure `selectPod`, `inviteCode` (accepts a bare code or a full link), `inviteLink`,
  `roleDisplayLabel`, `permissions`. `integration.ts`: the `PodIntegration` port type.
- `view.ts`: escaped lit templates. `pods.css`, prefix `pods-`.

Ports (`PodIntegration`, from `src/app/pods.ts`): `openOverlay` / `closeOverlay` (tad-modal), `confirm`,
`actionConfirm`, `paintOpenGatherings` (emits `gatherings:paint`). The app also refreshes Chronicles on
`pods:active`, switches to the MyPods tab on `pods:navigate`, re-renders on `pods:refresh` and provides the active
pod to other features (`src/app/active-pod.ts`).

Events: emits `pods:active`, `pods:navigate`, `auth:open`, `gatherings:sample`, `gatherings:host`, `profile:pod`,
`profile:player`, `spoilers:open`; listens to `pods:open` (Notifications). The pod repository emits
`pods:membership` after create/join/leave/remove/delete.

Data (Firestore, `src/services/cloud/pods.ts` and `members.ts`; names exact):

- `pods/{podId}`: `name`, `leaderId`, `coLeaderIds`, `memberIds`, `inviteCode`, `createdAt`.
- `pods/{podId}/members/{uid}`: `displayName`, `role` (`leader` / `co-leader` / `member`; shown as Steward /
  Co-Steward / Member), `joinedAt`.
- `users/{uid}` field `podIds` (self-written by `loadMyPods` so the rules can check "share a pod").
- Joining logs a `joined` activity. Limits: `PM_LIMITS.maxPodsPerUser`, `maxPodMembers`, `podName`.

No local storage.

## Testing

- Unit: `pods.test.ts` (selection, permissions, invite parsing), `lifecycle.test.ts` (signed-out auth, create, join
  validation and full URLs, failures, inert names, rename/regenerate, promote/transfer, pod switching, live invite
  disposal and merging, invite consent, declined invites, cache clearing).
- e2e: `pods.spec.ts` (signed-out entry and return to landing); signed-in flows are repository-mocked unit tests.
- Rules: `npm run test:rules` covers `pods/**` (see `firebase/coverage.md`).
- By hand: sign in, create a pod, copy the invite link, open it in a private window with a second account, accept;
  promote, then remove the second member.

## Risks and rollback

Pod and member documents are real shared data; never change their paths or fields. A revert does not undo pods
created or deleted. Roll back code with `git revert`.

## Follow-ups

- `integration.ts` still calls its ports "temporary ports for shared legacy dialogs and the not-yet-moved Gathering
  invitation painter"; both are moved (stale comment).

## Related

`004`, `013` (sign-in), `014` (profiles), `016` (Gatherings), `017` (Chronicles), `019` (Spoiler Bait), `023`
(Notifications open pods).
