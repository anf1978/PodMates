import { reportError } from "./report-error";

interface ScryfallOptions {
  /** Scryfall uses 404 for a valid lookup/search with no matches. */
  allowNotFound?: boolean;
  userTriggered?: boolean;
}

export async function fetchScryfallJson(
  url: string,
  init?: RequestInit,
  { allowNotFound = false, userTriggered = false }: ScryfallOptions = {},
): Promise<unknown> {
  try {
    const response = await fetch(url, init);
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) throw new Error(`Scryfall answered ${response.status}`);
    return await response.json();
  } catch (error) {
    reportError(error, { operation: "card-art", userTriggered });
    throw error;
  }
}
