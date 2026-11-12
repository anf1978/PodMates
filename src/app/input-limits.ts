// Applies a length limit to the page's text boxes the first time each one is used -- this covers
// the boxes created later by dialogs as well as the static ones. (The decklist box is deliberately
// NOT here: silently chopping a long paste could save half a deck, so it's checked with a message
// instead, in src/services/decklist-limits.ts.) The matching server-side limits live in
// firestore.rules.
import { PM_LIMITS, type PmLimits } from "../services/cloud/limits";

const INPUT_LIMIT_KEYS: Record<string, keyof PmLimits> = {
  commanderInput: "commanderName",
  playerInput: "playerName",
  deckNameInput: "deckName",
  deckLinkInput: "deckLinkUrl",
  profileDeckLinkInput: "deckLinkUrl",
  authDisplayName: "displayName",
  profileDisplayNameInput: "displayName",
  dbPlayerInput: "playerName",
  profileArchidektInput: "profileUrl",
  profileMoxfieldInput: "profileUrl",
  gatheringTitleInput: "gatheringTitle",
  saveLineupNameInput: "formationName",
  podCreateNameInput: "podName",
  podRenameInput: "podName",
  bestMomentInput: "bestMoment",
  dbCommanderSearch: "commanderName",
  dbCardSearch: "commanderName",
};

document.addEventListener("focusin", (e) => {
  const t = e.target as HTMLInputElement | null;
  if (!t || !t.id || !Object.prototype.hasOwnProperty.call(INPUT_LIMIT_KEYS, t.id)) return;
  if (t.maxLength > 0) return; // already limited
  t.maxLength = PM_LIMITS[INPUT_LIMIT_KEYS[t.id]];
});
