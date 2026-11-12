// Binds View Deck to the form and mounts the commander portraits. The delegated card/type clicks
// are src/app/card-clicks.ts.
import { matchDecklist } from "../cards/lookup";
import { parseDecklist } from "../cards/parse-decklist";
import { parseCommanderField } from "../engine/commanders";
import { mountCommanderHero, showDeckViewer } from "../features/card-viewer";
import { cardDb, isDbReady, lookupIndexes, pageContext } from "../services/card-data";
import { showToast } from "../ui/toast";

function fieldValue(id: string): string {
  return (
    (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? ""
  );
}

document.getElementById("viewDeckBtn")?.addEventListener("click", () => {
  if (!isDbReady()) return showToast("Card database still loading — try again in a moment.");
  const parsed = parseDecklist(fieldValue("decklistInput"));
  if (!parsed.entries.length) return showToast("Paste a decklist first.");
  const { matched } = matchDecklist(parsed.entries, cardDb(), lookupIndexes());
  if (!matched.length) return showToast("Could not read any cards from this decklist.");
  const commanders = parseCommanderField(pageContext(), fieldValue("commanderInput"));
  void showDeckViewer(matched, new Set(commanders));
});

mountCommanderHero();
