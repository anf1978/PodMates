// users/{uid}/linkedDecks: decks added by pasted Archidekt/Moxfield link. Every link (and re-sync)
// is mirrored into users/{uid}/decks under a stable linked-{platform}-{deckId} id, so ordinary pod
// sharing sees it and a rename on the source site updates the same mirror.
import { collection, db, deleteDoc, doc, getDoc, getDocs, setDoc } from "./firebase";
import { deckRef, loadAllDecks, saveDeck } from "./decks";
import { PM_LIMITS } from "./limits";
import { requireUser } from "./session";
import { clampText, countDocs, deckListProblem, docExistsSafe, safeDocId } from "./shared";
import type { DeckDoc, FetchedDeck, LinkedDeckDoc, WithId } from "./types";

declare global {
  interface Window {
    generateUniqueDeckName?: (name: string, existing: Set<string>) => string;
  }
}

// Runs server-side (deck-link-sync-worker.js): neither site reliably allows a request made
// directly from another website's browser code.
export const SYNC_WORKER_URL = "https://spring-unit-49d9.anthony-ef7.workers.dev/";

export type FetchDeckResult = { ok: true; deck: FetchedDeck } | { ok: false; error: string };

export const linkedDecksCol = (uid: string) => collection(db, "users", uid, "linkedDecks");
export const linkedDeckRef = (uid: string, id: string) => doc(db, "users", uid, "linkedDecks", id);

export function linkedDeckMirrorId(platform: string, deckId: string): string {
  return `linked-${platform}-${deckId}`;
}

export async function fetchDeckByLink(deckUrl: string): Promise<FetchDeckResult> {
  if (!deckUrl) return { ok: false, error: "No deck link provided." };
  try {
    const res = await fetch(`${SYNC_WORKER_URL}?deckUrl=${encodeURIComponent(deckUrl)}`);
    const data = await res.json();
    if (!res.ok)
      return { ok: false, error: data.error || `Request failed (status ${res.status}).` };
    return { ok: true, deck: data };
  } catch (err) {
    return { ok: false, error: "Could not reach the sync service: " + (err as Error).message };
  }
}

// The source platform occasionally has no title (an unnamed draft); fall back rather than letting
// "undefined" become a storage key.
function sourceDeckName(d: FetchedDeck): string {
  return clampText(
    (d.name && d.name.trim()) || (d.commander ? `${d.commander} (Linked)` : "Untitled Linked Deck"),
    PM_LIMITS.deckName,
  );
}

export async function addLinkedDeck(deckUrl: string) {
  const user = requireUser();
  const result = await fetchDeckByLink(deckUrl);
  if (!result.ok) return result;
  const d = result.deck;
  const L = PM_LIMITS;
  const linkedListProblem = deckListProblem(d.decklistText || "");
  if (linkedListProblem) return { ok: false as const, error: linkedListProblem };
  // Titles and commander names come from the other site, so trim rather than reject.
  d.commander = clampText(d.commander || "", L.commanderName);
  // Re-linking one that is already linked doesn't count against the cap.
  if (
    L.maxLinkedDecks &&
    !(await docExistsSafe(linkedDeckRef(user.uid, `${d.platform}-${d.deckId}`)))
  ) {
    const haveLinked = await countDocs(linkedDecksCol(user.uid));
    if (haveLinked >= L.maxLinkedDecks)
      return {
        ok: false as const,
        error: `You've reached the limit of ${L.maxLinkedDecks} linked decks. Remove one to link another.`,
      };
  }
  const sourceName = sourceDeckName(d);
  // Linking is a deliberate one-time action, so a name collision is auto-disambiguated rather
  // than offering to overwrite a deck the person may not have been thinking about.
  const existingDecks = await loadAllDecks().catch(() => ({}));
  const existingNames = new Set(
    Object.entries(existingDecks).map(([k, e]) => (e as { deckName?: string }).deckName || k),
  );
  const finalName = window.generateUniqueDeckName!(sourceName, existingNames);

  const id = `${d.platform}-${d.deckId}`;
  const linked: LinkedDeckDoc = {
    platform: d.platform,
    deckId: d.deckId,
    url: d.url,
    name: finalName,
    commander: d.commander,
    decklistText: d.decklistText as string,
    cardCount: d.cardCount,
    addedAt: Date.now(),
    syncedAt: Date.now(),
  };
  await setDoc(linkedDeckRef(user.uid, id), linked);
  await saveDeck(
    finalName,
    { commander: d.commander, list: d.decklistText, player: user.displayName || "", secret: false },
    linkedDeckMirrorId(d.platform, d.deckId),
  ).catch(() => {}); // linking itself already succeeded -- don't fail the whole action over the mirror
  return { ok: true as const, deck: { ...d, name: finalName }, id, renamed: finalName !== d.name };
}

export async function refreshLinkedDeck(id: string, deckUrl: string) {
  const user = requireUser();
  const result = await fetchDeckByLink(deckUrl);
  if (!result.ok) return result;
  const d = result.deck;
  const refreshListProblem = deckListProblem(d.decklistText || "");
  if (refreshListProblem) return { ok: false as const, error: refreshListProblem };
  d.commander = clampText(d.commander || "", PM_LIMITS.commanderName);
  const sourceName = sourceDeckName(d);
  await setDoc(
    linkedDeckRef(user.uid, id),
    {
      platform: d.platform,
      deckId: d.deckId,
      url: d.url,
      name: sourceName,
      commander: d.commander,
      decklistText: d.decklistText,
      cardCount: d.cardCount,
      syncedAt: Date.now(),
    },
    { merge: true },
  );
  // Re-sync updates the SAME mirror but deliberately keeps its secret flag, so a person who marked
  // it secret after linking doesn't have that undone by a routine re-sync.
  let existingSecret = false;
  try {
    const existing = await getDoc(
      deckRef(user.uid, safeDocId(linkedDeckMirrorId(d.platform, d.deckId))),
    );
    if (existing.exists()) existingSecret = (existing.data() as DeckDoc).secret === true;
  } catch {
    // fall back to not-secret
  }
  await saveDeck(
    sourceName,
    {
      commander: d.commander,
      list: d.decklistText,
      player: user.displayName || "",
      secret: existingSecret,
    },
    linkedDeckMirrorId(d.platform, d.deckId),
  ).catch(() => {});
  return { ok: true as const, deck: d };
}

export async function removeLinkedDeck(id: string): Promise<void> {
  const user = requireUser();
  await deleteDoc(linkedDeckRef(user.uid, id));
  // id is already `${platform}-${deckId}`, so the mirror's id can be reconstructed from it.
  await deleteDoc(deckRef(user.uid, safeDocId(`linked-${id}`))).catch(() => {});
}

export async function loadLinkedDecks(): Promise<Array<WithId<LinkedDeckDoc>>> {
  const user = requireUser();
  const snap = await getDocs(linkedDecksCol(user.uid));
  const out: Array<WithId<LinkedDeckDoc>> = [];
  snap.forEach((docSnap) => out.push({ id: docSnap.id, ...(docSnap.data() as LinkedDeckDoc) }));
  out.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  return out;
}
