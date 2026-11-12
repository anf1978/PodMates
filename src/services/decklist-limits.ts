// The page's friendly check on a pasted or stored decklist's size (the cloud layer enforces the same
// limits with shorter messages, and firestore.rules holds the hard ones).
import { PM_LIMITS } from "./cloud/limits";

/** A plain-English problem with the decklist, or "" if it is fine. */
export function decklistProblem(raw: unknown): string {
  const text = String(raw == null ? "" : raw);
  const L = PM_LIMITS;
  if (text.length > L.deckListChars) {
    return `That decklist is too long (${text.length.toLocaleString()} characters; the limit is ${L.deckListChars.toLocaleString()}). A normal 100-card list is about 3,000 — it may have extra text pasted in.`;
  }
  const lines = text.split("\n").length;
  if (lines > L.deckListLines) {
    return `That decklist has too many lines (${lines.toLocaleString()}; the limit is ${L.deckListLines.toLocaleString()}). A normal Commander list is about 100.`;
  }
  return "";
}
