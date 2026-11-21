# 049: Card note chips start from PodMates' own read of the card

Date: 2026-11-22

## Summary

When a deck's owner opens a new card note in View Deck, the role chips start filled in with how PodMates reads
that card. The owner adds or removes chips for their deck only. The note saves both the crafter's chips and
PodMates' read, so the copied text shows where they disagree, which is the signal for tuning. There are five new
chips, each separate: **Tutor**, **Board wipe**, **Counterspell**, **Recursion** and **Stax**. No scores change.

## What users see

- Twelve chips: Ramp, Draw, Tutor, Removal, Board wipe, Counterspell, Protection, Recursion, Stax,
  Win condition, Combo piece, Synergy.
- A new note starts with PodMates' read selected, under the line "PodMates reads this card as Ramp, Draw. Change
  them if your deck uses it differently." A card with no read says "PodMates has no role for this card."
- An existing note keeps the crafter's own chips and shows no read line. Podmates see only the crafter's
  chips, as before.
- **Copy deck, primer and notes**: where the crafter changed the chips, the line adds what PodMates said, for
  example `- Rhystic Study [Draw] (PodMates said: Draw, Stax): ...`.

## How it works

- PodMates' read comes from `src/app/card-viewer.ts` `cardRoles()`:
  - the engine's `classifyCard()` tags, mapped by `rolesFromTraits()` (`src/features/deck-notes/state.ts`);
  - Ramp covers ramp, mana creatures and rocks, fast mana, extra lands, Treasure, rituals, cost reducers, mana
    enchantments and multipliers;
  - Recursion is the reanimate tag;
  - Win condition covers alternate wins and infect;
  - Combo piece is set when the card is in a combo the deck's analysis finds (one analysis per View Deck
    opening);
  - Synergy is never pre-filled.
- `CardNote.app` (optional) stores PodMates' read when the note was saved. `NoteRole` and `NOTE_ROLES` gain
  `tutor`, `wipe`, `counter`, `recursion` and `stax`.
- No rules change: the rules check only the number of card notes, not their contents.

## Testing

- `deck-notes.test.ts`: a new note starts from the read and saves both views; an existing note keeps its
  chips; the engine-tag mapping; and the copied text showing "PodMates said".
- By hand against the pinned card data:
  - Sol Ring, Arcane Signet, Cultivate and Llanowar Elves: Ramp.
  - Swords to Plowshares and Beast Within: Removal.
  - Counterspell: Counterspell.
  - Wrath of God, Cyclonic Rift and Toxic Deluge: Board wipe.
  - Reanimate and Animate Dead: Recursion.
  - Heroic Intervention and Lightning Greaves: Protection.
  - Thassa's Oracle: Win condition.
- Known quirks, for crafters to correct:
  - Demonic Tutor reads as Draw, Tutor.
  - Rhystic Study reads as Draw, Stax.

## Risks and rollback

None to data: older notes keep their chips. Revert with `git revert <sha>`.

## Follow-ups

None.

## Related

047 (deck notes).
