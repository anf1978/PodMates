// Plain-text importer format; preserve full card names and omit commanders from the main deck.
export interface ExportDeck {
  commanders: readonly string[];
  matched: readonly { qty: number; card: { n: string } }[];
}

export function buildExportText(deck: ExportDeck): string {
  const commanders = new Set(deck.commanders.map((name) => name.toLowerCase()));
  return [
    "Commander",
    ...deck.commanders.map((name) => `1 ${name}`),
    "",
    "Deck",
    ...deck.matched
      .filter(({ card }) => !commanders.has(card.n.toLowerCase()))
      .map(({ card, qty }) => `${qty} ${card.n}`),
  ].join("\n");
}
