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
  removal: "Removal",
  protection: "Protection",
  wincon: "Win condition",
  combo: "Combo piece",
  synergy: "Synergy",
};

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
    const roles = note.roles.map((role) => ROLE_LABELS[role]).join(", ");
    return `- ${name}${roles ? ` [${roles}]` : ""}${note.text ? `: ${note.text.replace(/\s*\n\s*/g, " / ")}` : ""}`;
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
