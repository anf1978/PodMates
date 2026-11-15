# 042: First-use tips for My Profile, MyPods and the pod features (tutorials, phase 3)

Date: 2026-11-15

## Summary

The social side of PodMates now explains itself the first time someone opens each part: My Profile, MyPods, a
pod's page, hosting and running a Gathering, Pod Comparison, Chronicles, Impact cards, Spoiler Bait, the
notifications bell, player and pod profiles, and the deck preview from a notice. Like the deck-tool tips, each
shows once per device in a short card with **Got it** and **No more tips**.

## What users see

| First time you open…         | Tip                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| My Profile                   | display name, linked Moxfield/Archidekt decks kept in sync, My Data backup                 |
| MyPods                       | your playgroups; create or join with an invite link; Sample a Gathering if you have no pod |
| a pod                        | members, invite link, game nights; the Full Ledger lists the pod's shared decks            |
| Host a Gathering             | pick a time, invite podmates, add guests; everyone picks a deck for their seat             |
| a Gathering                  | seats and decks; chart the table, then log the battle                                      |
| Pod Comparison               | decks ranked by Command Spark; close Sparks make a fairer game                             |
| Chronicles (rating or notes) | rate the battle and add notes; history and Deck Log battle counts build from these         |
| Impact cards                 | pod changes only affect the separate Pod view line, never the main scores                  |
| Spoiler Bait                 | vote Bang or Bin; the pod board shows everyone's votes                                     |
| the bell                     | what's new in your pods; choose what to hear about                                         |
| a player profile             | their style from shared decks                                                              |
| a pod profile                | the pod at a glance; tap a dot in the pace chart to chart that deck                        |
| a deck preview               | a deck at a glance; Chart this deck for the full analysis                                  |

## How it works

- `src/features/tutorials/tips.ts`: 13 more `when` tips keyed on existing markup (`.profile-title`, `#podMode`,
  `.pods-title`, `#hostSeatsArea`, `#gatheringSeatsArea`, `#podRankArea`, `.chronicles-dialog-heading`,
  `.impact-title`, `.sb-heading`, `.pm-notif-title`, `#playerProfileContent .pp-header`,
  `#podProfileContent .pp-header`, `.pp-deck-preview .pp-deck-stats`). No other feature changes.
- Same device-only storage (`pm_tips`) and behaviour as 041. No Firestore changes.

## Testing

- `src/features/tutorials/tips.test.ts` → `tip markers`: every class and id any tip relies on must still appear in
  a feature's markup or `index.html`, so renaming a heading can't silently break a tip. Existing tip tests cover
  showing, closing and switching off.
- By hand: in a private window, sign in, tap No thanks on the welcome, then open MyPods, a pod and the bell.

## Risks and rollback

The MyPods tip stays until Got it (the tab doesn't close like a dialog). Revert with `git revert <sha>`.

## Follow-ups

None planned. New features should add a tip to `tips.ts` when they ship.

## Related

040, 041 (tutorials phases 1 and 2).

Later changes: 043
