// Best-effort draft persistence, retaining the existing localStorage key and fields.
import { reportError } from "../../services/report-error";
import type { Draft } from "./state";

const KEY = "podmates-deck-builder-draft";

function warn(error: unknown): void {
  reportError(error, { operation: "deck-crafter", severity: "warning" });
}

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        cards: draft.cards,
        commander: draft.commander,
        player: draft.player,
      }),
    );
  } catch (error) {
    warn(error);
  }
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const draft: unknown = JSON.parse(raw);
    if (
      typeof draft !== "object" ||
      draft === null ||
      !("cards" in draft) ||
      typeof draft.cards !== "object" ||
      draft.cards === null ||
      Array.isArray(draft.cards) ||
      !Object.values(draft.cards).every((qty) => typeof qty === "number" && Number.isFinite(qty)) ||
      !("commander" in draft) ||
      (draft.commander !== null && typeof draft.commander !== "string") ||
      !("player" in draft) ||
      typeof draft.player !== "string"
    ) {
      throw new Error("Invalid Deck Crafter draft");
    }
    return {
      cards: draft.cards as Record<string, number>,
      commander: draft.commander,
      player: draft.player,
    };
  } catch (error) {
    warn(error);
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch (error) {
    warn(error);
  }
}
