// Deck notes and Spark checks for a saved deck. The primer and card notes are one document,
// users/{uid}/decks/{deckId}/notes/current, read when View Deck opens; Spark checks (the owner's
// "stronger / about right / weaker than its Spark" after a battle) are users/{uid}/decks/{deckId}/
// sparkChecks/{chronicleId}. Only the owner writes either; podmates read them like the deck itself.
import { collection, db, doc, getDoc, getDocs, setDoc } from "./firebase";
import { PM_LIMITS } from "./limits";
import { requireUser } from "./session";
import { clampText } from "./shared";
import type { DeckRef } from "./deck-log";
import type {
  CardNote,
  DeckNotesDoc,
  NoteRole,
  SparkCheckDoc,
  SparkVerdict,
  WithId,
} from "./types";

export const NOTE_ROLES: readonly NoteRole[] = [
  "ramp",
  "draw",
  "tutor",
  "removal",
  "wipe",
  "counter",
  "protection",
  "recursion",
  "stax",
  "wincon",
  "combo",
  "synergy",
];
export const SPARK_VERDICTS: readonly SparkVerdict[] = ["stronger", "right", "weaker"];

const notesDoc = (ref: DeckRef) => doc(db, "users", ref.uid, "decks", ref.id, "notes", "current");
const checksCol = (ref: DeckRef) =>
  collection(db, "users", ref.uid, "decks", ref.id, "sparkChecks");

export const emptyNotes = (): DeckNotesDoc => ({
  primer: "",
  cards: {},
  shareForTuning: false,
  updatedAt: 0,
});

/** Tidies a stored or typed note: known roles once each, text within the limit. */
const knownRoles = (roles: unknown): NoteRole[] =>
  Array.isArray(roles) ? NOTE_ROLES.filter((role) => roles.includes(role)) : [];

export function cleanNote(note: {
  roles?: unknown;
  text?: unknown;
  at?: unknown;
  app?: unknown;
}): CardNote {
  return {
    roles: knownRoles(note.roles),
    text: clampText(String(note.text ?? "").trim(), PM_LIMITS.cardNote),
    at: Number(note.at) || 0,
    ...(Array.isArray(note.app) ? { app: knownRoles(note.app) } : {}),
  };
}

function cleanNotes(data: Partial<DeckNotesDoc> | undefined): DeckNotesDoc {
  const cards: Record<string, CardNote> = {};
  for (const [name, note] of Object.entries(data?.cards ?? {})) {
    const clean = cleanNote(note ?? {});
    if (clean.text || clean.roles.length) cards[name] = clean;
  }
  return {
    primer: String(data?.primer ?? ""),
    cards,
    shareForTuning: data?.shareForTuning === true,
    updatedAt: Number(data?.updatedAt) || 0,
  };
}

/** The deck's notes (empty when it has none), or null when they can't be read. */
export async function loadDeckNotes(ref: DeckRef): Promise<DeckNotesDoc | null> {
  requireUser();
  const snap = await getDoc(notesDoc(ref));
  return snap.exists() ? cleanNotes(snap.data() as Partial<DeckNotesDoc>) : emptyNotes();
}

async function writeNotes(ref: DeckRef, next: DeckNotesDoc): Promise<DeckNotesDoc> {
  const user = requireUser();
  if (user.uid !== ref.uid) throw new Error("Only the deck's owner can change its notes.");
  const data = { ...next, updatedAt: Date.now() };
  await setDoc(notesDoc(ref), data);
  return data;
}

/** Owner: sets (or, with null or an empty note, removes) one card's note, with PodMates' own read of
 * the card (`app`) for comparison. Returns the new notes. */
export async function saveCardNote(
  ref: DeckRef,
  card: string,
  note: { roles: readonly NoteRole[]; text: string; app?: readonly NoteRole[] } | null,
): Promise<DeckNotesDoc> {
  const current = (await loadDeckNotes(ref)) ?? emptyNotes();
  const cards = { ...current.cards };
  const clean = note ? cleanNote({ ...note, at: Date.now() }) : null;
  if (clean && (clean.text || clean.roles.length)) {
    if (!cards[card] && Object.keys(cards).length >= PM_LIMITS.cardNotes)
      throw new Error(`A deck can have notes on up to ${PM_LIMITS.cardNotes} cards.`);
    cards[card] = clean;
  } else delete cards[card];
  return writeNotes(ref, { ...current, cards });
}

/** Owner: sets the primer and whether the notes may be used to tune Spark. Returns the new notes. */
export async function saveDeckPrimer(
  ref: DeckRef,
  primer: string,
  shareForTuning: boolean,
): Promise<DeckNotesDoc> {
  const current = (await loadDeckNotes(ref)) ?? emptyNotes();
  return writeNotes(ref, {
    ...current,
    primer: clampText(primer.trim(), PM_LIMITS.deckPrimer),
    shareForTuning,
  });
}

/** Owner: records how their deck played against its Spark in one battle (one answer per battle). */
export async function saveSparkCheck(
  ref: DeckRef,
  chronicleId: string,
  podId: string,
  verdict: SparkVerdict,
  spark: number | null,
): Promise<void> {
  const user = requireUser();
  if (user.uid !== ref.uid) throw new Error("Only the deck's owner can answer for it.");
  if (!SPARK_VERDICTS.includes(verdict)) throw new Error("Unknown answer.");
  const check: SparkCheckDoc = {
    verdict,
    spark: Number.isFinite(spark) ? spark : null,
    at: Date.now(),
    podId: clampText(podId, 80),
  };
  await setDoc(doc(checksCol(ref), chronicleId), check);
}

/** The deck's Spark checks, newest first. */
export async function loadSparkChecks(ref: DeckRef): Promise<WithId<SparkCheckDoc>[]> {
  requireUser();
  const snap = await getDocs(checksCol(ref));
  const checks: WithId<SparkCheckDoc>[] = [];
  snap.forEach((d) => {
    const data = d.data() as Partial<SparkCheckDoc>;
    if (data.verdict && SPARK_VERDICTS.includes(data.verdict))
      checks.push({
        id: d.id,
        verdict: data.verdict,
        spark: typeof data.spark === "number" ? data.spark : null,
        at: Number(data.at) || 0,
        podId: String(data.podId ?? ""),
      });
  });
  return checks.sort((a, b) => b.at - a.at);
}
