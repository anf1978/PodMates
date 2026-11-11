// TODO(p3-6): remove when Deck Crafter supplies these explicit scanner dependencies.
import { mount } from "./index";
import { addScannedCards } from "./state";
import { parseDecklist } from "../../cards/parse-decklist";
import { fuzzyFindCard, type LookupIndexes } from "../../cards/lookup";
import type { CardRecord } from "../../cards/tuple";
import { PM_LIMITS } from "../../services/cloud/limits";

declare const CARD_DB: CardRecord[];
declare const indexes: LookupIndexes;
declare let deckBuilderCards: Record<string, number>;
declare const deckBuilderCommanderName: string | null;
declare const deckBuilderFilterByIdentity: boolean;
declare function dbIdentityCard(): Pick<CardRecord, "ci"> | null;
declare function cardFitsCommanderIdentity(
  card: CardRecord,
  commander: Pick<CardRecord, "ci">,
): boolean;
declare function saveDeckBuilderDraft(): void;
declare function openDeckBuilderOverlay(): void;

const input = document.getElementById("scanCardsFileInput") as HTMLInputElement | null;
const scanner = input
  ? mount(input, {
      cards: () => CARD_DB,
      indexes: () => indexes,
      inDeck() {
        const names = new Set(Object.keys(deckBuilderCards));
        const textarea = document.getElementById("decklistInput") as HTMLTextAreaElement | null;
        for (const entry of parseDecklist(textarea?.value || "").entries) {
          const match = fuzzyFindCard(entry.name, CARD_DB, indexes);
          if (match) names.add(match.card.n);
        }
        return names;
      },
      returnToBuilder: () => openDeckBuilderOverlay(),
      add(cards) {
        const commander = deckBuilderCommanderName ? dbIdentityCard() : null;
        const added = addScannedCards(
          cards,
          deckBuilderCards,
          (card) =>
            !deckBuilderFilterByIdentity ||
            !commander ||
            cardFitsCommanderIdentity(card, commander),
          PM_LIMITS,
        );
        deckBuilderCards = added.cards;
        saveDeckBuilderDraft();
        return { ...added, commander: deckBuilderCommanderName };
      },
    })
  : null;

declare global {
  interface Window {
    // TODO(p3-6): only the unmoved Deck Crafter's Scan button calls this.
    showScanCardsModal: () => void;
  }
}
window.showScanCardsModal = () => scanner?.open();
