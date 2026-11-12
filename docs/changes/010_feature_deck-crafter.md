# 010: Deck Crafter, the in-app deck builder

Date: 2026-11-12

## Summary

Deck Crafter lets you build or edit a Commander deck without another website: pick a commander (and a partner),
search for cards that fit its colours, adjust quantities, scan cards from photos, then save or chart the deck. An
unfinished deck is kept on your device, so closing the dialog or the browser loses nothing.

## What users see

On the **Deck Chart** tab, the **Deck Crafter** button (`#openDeckBuilderBtn`) opens a dialog (480 px wide):

- If the card database is still loading: toast "Card database still loading — try again in a moment."
- A notice: "Picked up where you left off." with **Start New Deck** (asks for confirmation) and **Load <commander>
  instead**, or "Editing <commander> from Deck Chart." when the form already holds a deck.
- **Commander** search (commanders ranked first) with partner support; **Player** (required to save).
- **Add cards** search, filtered to the commander's colours unless you untick the identity toggle; the list with
  quantity controls and removal; the card count.
- **📷 Scan cards from a photo** (`009`), **Save Deck** and **Chart This Deck**.
- Save needs at least one card, a commander and a player; it writes the deck into the form, keeps a hand-typed
  Deck Name when the commander and player are unchanged, clears the draft and runs Save (`012`). Chart writes the
  list into the form, switches to the Deck Chart tab and charts it (`005`).

## How it works

- `index.ts`: `openDeckBuilderOverlay` (draft vs current-deck choice, buttons, scroll/focus fixes for phones) and
  `mount(ports)`, which binds the opener and registers the editor with `services/deck-editing.ts` (`open`, `cards`,
  `commander`, `accepts`, `update`) so the scanner can add cards without importing this feature.
- `state.ts`: pure draft state: `createState`, `restore` (draft wins over the form until Load Current or Start New
  is chosen), `setCommander`, `addPartner`, `removeCommander`, `addCard`, `setQuantity` (bounded by
  `PM_LIMITS.builderMaxCards` and copy limits), `fitsIdentity`, `fromDecklist`, `deckText`.
- `search.ts`: the commander and card pickers (debounce, touch selection, identity filter) over the ranked search.
- `panels.ts` (commander and list templates), `view.ts` (the dialog), `draft.ts` (local storage), `ports.ts`.
  `deck-crafter.css`, classes `db-` inside `.deck-crafter`, plus scoped `.deck-crafter .pm-sr*` picker styles.

Ports (`CrafterPorts`, from `src/app/deck-crafter.ts`): `ready`, `findCard`, `rankingsReady`, `search`
(`services/card-data`, ranked by `src/cards/search.ts`), `confirm` (`ui/confirm`), `resetDeckName`
(`services/deck-form`), `saveDeck` (emits `decks:save`), `setSingleMode` (`app/mode`), `chart` (`runChart()`).

Events: Save emits `decks:save` (through the port), which Saved Decks handles.

Data: local storage key `podmates-deck-builder-draft` holding `{ cards, commander, player }` (unchanged from the old
page). Storage failures report as warnings (operation `deck-crafter`) and never block editing. No Firestore calls
of its own. Card rankings come from the lazy deck library.

## Testing

- Unit: `deck-crafter.test.ts` (draft beats the form; Start New stays empty; partner replacement keeps extra
  copies; partner identity union and colourless cards; capacity and quantity bounds).
- e2e: `deck-crafter.spec.ts` (draft restore, quantities, chart handoff; draft vs Load Current / Start New;
  identity toggle and Save keeping the deck name), `r1-features.spec.ts` (scan handoff).
- By hand: open Deck Crafter, search a commander, add a few cards, close the dialog, reopen (draft restored), press
  Chart This Deck.

## Risks and rollback

A bug here can lose a draft on the device; saved decks in the cloud are not touched. Roll back with `git revert`.

## Follow-ups

- The header comment in `index.ts` still says "page orchestration is injected until p3-6"; p3-6 is done, so the
  comment is stale (docs-only fix for a later change).

## Related

`004`, `005`, `006`, `009` (scan), `012` (Save).
