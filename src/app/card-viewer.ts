// Binds View Deck to the form (with the saved deck's notes and PodMates' read of each card) and mounts the
// commander portraits. The delegated card/type clicks are src/app/card-clicks.ts.
import { matchDecklist, normalizeName } from "../cards/lookup";
import { parseDecklist } from "../cards/parse-decklist";
import { parseCommanderField } from "../engine/commanders";
import { mountCommanderHero, showDeckViewer } from "../features/card-viewer";
import { deckNotesExtras } from "../features/deck-notes";
import { rolesFromTraits } from "../features/deck-notes/state";
import { classifyCard } from "../engine/classify";
import type { NoteRole } from "../services/cloud/types";
import { analyzeOneList } from "./analysis";
import { getCurrentUser } from "../services/cloud/session";
import { chartedDeck } from "../services/deck-form";
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
  // Deck notes: the saved deck in the form (if any) and who is looking.
  const saved = chartedDeck();
  const user = getCurrentUser();
  const notes = deckNotesExtras({
    ref: saved ? { uid: saved.uid, id: saved.id } : null,
    me: user && !user.isAnonymous ? user.uid : null,
    deckName: saved?.name || fieldValue("deckNameInput"),
    commander: fieldValue("commanderInput"),
    list: fieldValue("decklistInput"),
    suggest: cardRoles(fieldValue("decklistInput"), fieldValue("commanderInput")),
  });
  void showDeckViewer(matched, new Set(commanders), notes);
});

mountCommanderHero();

/** PodMates' own read of each card in this deck as note chips: the engine's per-card tags, plus Combo
 * piece for cards in a combo the deck analysis finds. The analysis runs once, on first use. */
function cardRoles(list: string, commander: string): (name: string) => NoteRole[] | null {
  let comboCards: Set<string> | null = null;
  return (name) => {
    if (!isDbReady()) return null;
    const card = lookupIndexes().byExactName.get(normalizeName(name));
    if (!card) return null;
    comboCards ??= new Set(
      (analyzeOneList(list, "", commander)?.agg.detectedComboDetails ?? []).flatMap((combo) =>
        combo.cards.map(normalizeName),
      ),
    );
    return rolesFromTraits(classifyCard(card), comboCards.has(normalizeName(name)));
  };
}
