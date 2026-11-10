import { expect, test } from "vitest";

test("the test runner supports TypeScript and ES modules", () => {
  const deck: { name: string; cards: string[] } = {
    name: "Tooling baseline",
    cards: [],
  };

  expect(deck.cards).toEqual([]);
});
