// Pure OCR matching and builder handoff; quantities never come from a photo.
import type { CardRecord } from "../../cards/tuple";

export interface ScanResult {
  card: CardRecord;
  checked: boolean;
}

export function sortedNames(cards: readonly CardRecord[]): { name: string; lower: string }[] {
  return cards
    .map((card) => card.n)
    .filter((name) => name.length >= 6)
    .sort((a, b) => b.length - a.length)
    .map((name) => ({ name, lower: name.toLowerCase() }));
}

export function matchPhotoText(
  text: string,
  names: ReturnType<typeof sortedNames>,
  byExactName: ReadonlyMap<string, CardRecord>,
  results: readonly ScanResult[],
  inDeck: ReadonlySet<string>,
): ScanResult[] {
  let blob = ` ${text.replace(/\s+/g, " ").toLowerCase()} `;
  const found = new Set([...results.map(({ card }) => card.n), ...inDeck]);
  const next = [...results];
  for (const { name, lower } of names) {
    if (found.has(name)) continue;
    if (!blob.includes(lower)) continue;
    const card = byExactName.get(lower);
    if (!card) continue;
    next.push({ card, checked: true });
    found.add(name);
    // Consume every occurrence before shorter names can become phantom extra cards.
    blob = blob.split(lower).join(" ".repeat(lower.length));
  }
  return next;
}

export interface AddedCards {
  cards: Record<string, number>;
  added: number;
  offColour: number;
  full: number;
}

export function addScannedCards(
  chosen: readonly CardRecord[],
  existing: Readonly<Record<string, number>>,
  fits: (card: CardRecord) => boolean,
  limits: { builderMaxCards: number; builderMaxQty: number },
): AddedCards {
  const result: AddedCards = { cards: { ...existing }, added: 0, offColour: 0, full: 0 };
  for (const card of new Set(chosen)) {
    if (!fits(card)) {
      result.offColour++;
      continue;
    }
    if (!result.cards[card.n] && Object.keys(result.cards).length >= limits.builderMaxCards) {
      result.full++;
      continue;
    }
    result.cards[card.n] = Math.min((result.cards[card.n] || 0) + 1, limits.builderMaxQty);
    result.added++;
  }
  return result;
}
