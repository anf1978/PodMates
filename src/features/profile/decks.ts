// Profile deck reads and mirror repair use the typed cloud repositories.
import { loadAllDecks, saveDeck } from "../../services/cloud/decks";
import { loadLinkedDecks } from "../../services/cloud/linked-decks";
import { getCurrentUser } from "../../services/cloud/session";
import { reportError } from "../../services/report-error";
import { mergeDecks, type ProfileDeck } from "./state";

export async function loadAndMergeMyDecks(): Promise<ProfileDeck[]> {
  if (!getCurrentUser()) return [];
  const [saved, linked] = await Promise.all([
    loadAllDecks().catch((error: unknown) => {
      reportError(error, { operation: "cloud" });
      return {};
    }),
    loadLinkedDecks().catch((error: unknown) => {
      reportError(error, { operation: "cloud" });
      return [];
    }),
  ]);
  const { decks, backfill } = mergeDecks(saved, linked);
  for (const deck of backfill) {
    try {
      await saveDeck(
        deck.name,
        {
          commander: deck.commander || "",
          list: deck.decklistText || "",
          player: "",
          secret: false,
        },
        `linked-${deck.id}`,
        { updateNotice: false }, // repairing a missing mirror is not an edit
      );
    } catch (error) {
      // The row stays visible even when the best-effort mirror repair fails.
      reportError(error, { operation: "cloud" });
    }
  }
  return decks;
}
