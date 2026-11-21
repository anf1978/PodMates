// Deck notes: role labels, which notes belong to cards no longer in the deck, and the text bundle the
// owner copies (decklist, primer, card notes and Spark checks together). No DOM work here.
import type {
  CardNote,
  DeckNotesDoc,
  NoteRole,
  SparkCheckDoc,
  SparkVerdict,
} from "../../services/cloud/types";

export const ROLE_LABELS: Record<NoteRole, string> = {
  ramp: "Ramp",
  draw: "Draw",
  tutor: "Tutor",
  removal: "Removal",
  wipe: "Board wipe",
  counter: "Counterspell",
  protection: "Protection",
  recursion: "Recursion",
  stax: "Stax",
  wincon: "Win condition",
  combo: "Combo piece",
  synergy: "Synergy",
};

/** The engine tags a card carries (from classifyCard), as far as the chips need them. */
export interface CardTraitFlags {
  ramp?: boolean;
  manaDork?: boolean;
  manaRock?: boolean;
  fastMana?: boolean;
  extraLand?: boolean;
  treasureRamp?: boolean;
  ritual?: boolean;
  costReducer?: boolean;
  manaEnchantment?: boolean;
  manaMultiplier?: boolean;
  draw?: boolean;
  tutor?: boolean;
  removal?: boolean;
  wipe?: boolean;
  counterMagic?: boolean;
  protection?: boolean;
  reanimate?: boolean;
  stax?: boolean;
  altWin?: boolean;
  infect?: boolean;
}

/** PodMates' own read of a card as chips: its engine tags, plus Combo piece when the card is in a
 * combo found in this deck. Synergy is left to the crafter. */
export function rolesFromTraits(t: CardTraitFlags, inCombo: boolean): NoteRole[] {
  const roles: NoteRole[] = [];
  if (
    t.ramp ||
    t.manaDork ||
    t.manaRock ||
    t.fastMana ||
    t.extraLand ||
    t.treasureRamp ||
    t.ritual ||
    t.costReducer ||
    t.manaEnchantment ||
    t.manaMultiplier
  )
    roles.push("ramp");
  if (t.draw) roles.push("draw");
  if (t.tutor) roles.push("tutor");
  if (t.removal) roles.push("removal");
  if (t.wipe) roles.push("wipe");
  if (t.counterMagic) roles.push("counter");
  if (t.protection) roles.push("protection");
  if (t.reanimate) roles.push("recursion");
  if (t.stax) roles.push("stax");
  if (t.altWin || t.infect) roles.push("wincon");
  if (inCombo) roles.push("combo");
  return roles;
}

export const roleList = (roles: readonly NoteRole[]): string =>
  roles.map((role) => ROLE_LABELS[role]).join(", ");

export const VERDICT_LABELS: Record<SparkVerdict, string> = {
  stronger: "Stronger than its Spark",
  right: "About right",
  weaker: "Weaker than its Spark",
};

/** Notes on cards that are no longer in the deck, by name. */
export function removedNotes(
  notes: DeckNotesDoc,
  inDeck: ReadonlySet<string>,
): [string, CardNote][] {
  return Object.entries(notes.cards).filter(([name]) => !inDeck.has(name));
}

const day = (at: number) => (at ? new Date(at).toISOString().slice(0, 10) : "unknown date");

export interface NotesBundle {
  deckName: string;
  commander: string;
  list: string;
  notes: DeckNotesDoc;
  checks: readonly SparkCheckDoc[];
  /** Card names in the deck, in the order View Deck shows them. */
  order: readonly string[];
}

/** Plain text for pasting into a chat with Claude or a document: everything about the deck. */
export function notesBundle(bundle: NotesBundle): string {
  const { notes } = bundle;
  const inDeck = new Set(bundle.order);
  const line = (name: string, note: CardNote) => {
    const roles = roleList(note.roles);
    // Where the crafter changed PodMates' own read, show what PodMates said.
    const differs =
      note.app &&
      (note.app.length !== note.roles.length || note.app.some((r) => !note.roles.includes(r)));
    const app = differs ? ` (PodMates said: ${roleList(note.app!) || "nothing"})` : "";
    const text = note.text ? `: ${note.text.replace(/\s*\n\s*/g, " / ")}` : "";
    return `- ${name}${roles ? ` [${roles}]` : ""}${app}${text}`;
  };
  const cardLines = bundle.order
    .filter((name) => notes.cards[name])
    .map((name) => line(name, notes.cards[name]));
  const gone = removedNotes(notes, inDeck).map(([name, note]) => line(name, note));
  const checks = bundle.checks.map(
    (check) =>
      `- ${day(check.at)}: ${VERDICT_LABELS[check.verdict]}${check.spark === null ? "" : ` (Spark ${check.spark.toFixed(1)})`}`,
  );
  return [
    `PodMates deck notes: ${bundle.deckName || "Untitled deck"}`,
    `Commander: ${bundle.commander || "not set"}`,
    `Shared to help tune Spark: ${notes.shareForTuning ? "yes" : "no"}`,
    "",
    "== Decklist ==",
    bundle.list.trim(),
    "",
    "== Primer ==",
    notes.primer.trim() || "(none)",
    "",
    "== Card notes ==",
    ...(cardLines.length ? cardLines : ["(none)"]),
    ...(gone.length ? ["", "== Notes on cards no longer in the deck ==", ...gone] : []),
    "",
    "== After-battle Spark checks ==",
    ...(checks.length ? checks : ["(none)"]),
    "",
  ].join("\n");
}
