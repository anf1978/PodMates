// Validation and size-cap helpers shared by the repositories. Everything written to Firestore
// passes through here, so this is the one place that decides "too big". Text typed by a person is
// REJECTED with a clear message (silently chopping a deck name could point at a different
// document); text copied from somewhere else -- a Google account name, a title from Moxfield -- is
// trimmed instead, since refusing it would strand someone over something they didn't type.
import { getCountFromServer, getDoc, type DocumentReference, type Query } from "./firebase";
import { PM_LIMITS } from "./limits";
import { reportError } from "../report-error";

// Firestore document keys can't contain "/" -- deck keys are built as "Commander (Player)" and
// names occasionally contain one (split cards, "Tymna / Kraum" partner pairs).
export function safeDocId(key: string): string {
  return encodeURIComponent(key).slice(0, 1500); // Firestore doc ID length limit
}

export function clampText(v: unknown, max?: number): string {
  return String(v == null ? "" : v).slice(0, max || 1000);
}

export function requireText(v: unknown, max: number | undefined, label: string): string {
  const s = String(v == null ? "" : v);
  if (max && s.length > max)
    throw new Error(`${label} is too long (${s.length} characters; the limit is ${max}).`);
  return s;
}

// Returns '' if the decklist is a sensible size, otherwise a plain-English problem.
export function deckListProblem(list: unknown): string {
  const text = String(list == null ? "" : list),
    L = PM_LIMITS;
  if (L.deckListChars && text.length > L.deckListChars) {
    return `That decklist is too long (${text.length.toLocaleString()} characters; the limit is ${L.deckListChars.toLocaleString()}).`;
  }
  if (L.deckListLines && text.split("\n").length > L.deckListLines) {
    return `That decklist has too many lines (the limit is ${L.deckListLines.toLocaleString()}).`;
  }
  return "";
}

// A deck name that doesn't collide with any existing one, appending " (2)", " (3)", etc.
export function uniqueDeckName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) return baseName;
  let n = 2;
  while (existingNames.has(`${baseName} (${n})`)) n++;
  return `${baseName} (${n})`;
}

// The count/exists checks behind the size caps are a convenience, not a gate: if the network is
// slow or the check fails, the save goes ahead (firestore.rules still holds the hard limits).
export const capCheckTimeout = <T>(p: Promise<T>): Promise<T> =>
  Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("cap check timed out")), 6000)),
  ]);

export async function countDocs(q: Query): Promise<number> {
  try {
    return (await capCheckTimeout(getCountFromServer(q))).data().count;
  } catch (e) {
    reportError(e, { operation: "cloud" });
    return 0;
  }
}

export async function docExistsSafe(ref: DocumentReference): Promise<boolean> {
  try {
    return (await capCheckTimeout(getDoc(ref))).exists();
  } catch (e) {
    reportError(e, { operation: "cloud" });
    return true; // "assume it exists", so the cap is not applied
  }
}

// Names only need to be unique within a pod. Comparison ignores case, extra spaces,
// composed/decomposed forms and invisible characters.
export function nameKey(name: unknown): string {
  return String(name == null ? "" : name)
    .normalize("NFKC")

    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2060\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function actorName(
  user: { displayName: string | null; email: string | null },
  fallback: string,
  max?: number,
): string {
  return clampText(user.displayName || user.email || fallback, max);
}
