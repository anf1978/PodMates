// users/{uid}/decks: saved decks, shared read-only with podmates unless marked secret.
import {
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "./firebase";
import { logActivity } from "./activity";
import { PM_LIMITS } from "./limits";
import { requireUser } from "./session";
import { countDocs, deckListProblem, docExistsSafe, requireText, safeDocId } from "./shared";
import type { DeckDoc, DeckInput, PodmateDeck, SavedDeck } from "./types";

export const decksCol = (uid: string) => collection(db, "users", uid, "decks");
export const deckRef = (uid: string, id: string) => doc(db, "users", uid, "decks", id);

// docIdOverride targets a deck by its real, stable document ID rather than its display key --
// essential for a linked deck's mirror (linked-{platform}-{deckId}).
export async function saveDeck(
  key: string,
  entry: DeckInput,
  docIdOverride?: string,
): Promise<void> {
  const user = requireUser();
  if (!key) throw new Error("Cannot save a deck with no name.");
  const L = PM_LIMITS;
  requireText(key, L.deckKey, "Deck name");
  requireText(entry.deckName || key, L.deckName, "Deck name");
  requireText(entry.commander || "", L.commanderName, "Commander name");
  requireText(entry.player || "", L.playerName, "Player name");
  const listProblem = deckListProblem(entry.list || "");
  if (listProblem) throw new Error(listProblem);
  const ref = deckRef(user.uid, safeDocId(docIdOverride || key));
  // Overwriting an existing deck never counts against the cap -- only creating a new one does.
  const deckExisted = await docExistsSafe(ref);
  if (L.maxSavedDecks && !deckExisted) {
    const have = await countDocs(decksCol(user.uid));
    if (have >= L.maxSavedDecks)
      throw new Error(
        `You've reached the limit of ${L.maxSavedDecks} saved decks. Delete one you no longer use to make room.`,
      );
  }
  await setDoc(ref, {
    key,
    commander: entry.commander || "",
    player: entry.player || "",
    list: entry.list || "",
    deckName: entry.deckName || key,
    savedAt: entry.savedAt || Date.now(),
    secret: entry.secret === true,
    updatedAt: serverTimestamp(),
  });
  if (!deckExisted && entry.secret !== true) logActivity("deck", entry.deckName || key);
}

export async function setDeckSecret(key: string, secret: unknown): Promise<void> {
  const user = requireUser();
  await setDoc(
    deckRef(user.uid, safeDocId(key)),
    { secret: secret === true, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// A docIdOverride is a REAL document id taken straight from Firestore, so it is already in its
// final (encoded) form. Try the id as given first, then the encoded key; whichever exists is
// deleted, and the result is checked so a failure can never look like success (Firestore reports
// a delete of a missing document as success).
export async function deleteDeck(key: string, docIdOverride?: string): Promise<boolean> {
  const user = requireUser();
  const ids: string[] = [];
  [docIdOverride, safeDocId(key || ""), key].forEach((x) => {
    if (x && !ids.includes(x) && !String(x).includes("/")) ids.push(x);
  });
  let found = false;
  for (const id of ids) {
    const ref = deckRef(user.uid, id);
    let snap = null;
    try {
      snap = await getDoc(ref);
    } catch {
      snap = null;
    }
    if (snap && snap.exists()) {
      await deleteDoc(ref);
      found = true;
      const again = await getDoc(ref).catch(() => null);
      if (again && again.exists())
        throw new Error("The deck could not be deleted. Please try again.");
    }
  }
  if (!found && ids.length) await deleteDoc(deckRef(user.uid, ids[0])).catch(() => {});
  return found;
}

export async function loadAllDecks(): Promise<Record<string, SavedDeck>> {
  const user = requireUser();
  const snap = await getDocs(decksCol(user.uid));
  const out: Record<string, SavedDeck> = {};
  snap.forEach((docSnap) => {
    const d = docSnap.data() as DeckDoc;
    out[d.key] = {
      list: d.list,
      commander: d.commander,
      player: d.player,
      deckName: d.deckName,
      savedAt: d.savedAt,
      secret: d.secret === true,
      docId: docSnap.id,
    };
    // A deck saved before the secret toggle existed has no `secret` field, which a podmate's
    // `where('secret', '==', false)` query can never match. Backfill it the next time its OWNER
    // views their own decks (always a legal self-write).
    if (d.secret === undefined) {
      setDoc(docSnap.ref, { secret: false }, { merge: true }).catch(() => {});
    }
  });
  return out;
}

// Reads ANOTHER user's saved decks -- only succeeds if firestore.rules allows it (shared pod).
// A denial is treated as "nothing shared".
export async function loadPodmateDecks(uid: string): Promise<Record<string, PodmateDeck>> {
  requireUser();
  try {
    return await loadPodmateDecksRaw(uid);
  } catch {
    return {};
  }
}

// Same query, but lets a real permission error through. Must filter explicitly on `secret ==
// false`, matching the rule's own condition; `!= true` would hide decks missing the field.
export async function loadPodmateDecksRaw(uid: string): Promise<Record<string, PodmateDeck>> {
  requireUser();
  const snap = await getDocs(query(decksCol(uid), where("secret", "==", false)));
  const out: Record<string, PodmateDeck> = {};
  snap.forEach((docSnap) => {
    const d = docSnap.data() as DeckDoc;
    out[d.key] = {
      list: d.list,
      commander: d.commander,
      player: d.player,
      savedAt: d.savedAt,
      secret: false,
      docId: docSnap.id,
    };
  });
  return out;
}
