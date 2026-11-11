// Behavioural coverage for filtering, shared votes and pod-board ordering.
import { expect, it } from "vitest";
import { boardRows, cardKey, createState, queue, setVote } from "./state";

it("filters known rarities, keeps unknowns visible and excludes votes across both sources", () => {
  const state = createState(["rare", "special"]);
  state.cards = [
    { key: cardKey("Test Relic"), n: "Test Relic", rarity: "rare", setName: "" },
    { key: "common", n: "Common", rarity: "common", setName: "" },
    { key: "bonus", n: "Bonus", rarity: "bonus", setName: "" },
    { key: "unknown", n: "Unknown", setName: "" },
  ];
  expect(queue(state).map((card) => card.key)).toEqual(["test-relic", "bonus", "unknown"]);
  setVote(state, state.cards[0], "like", 123);
  expect(queue(state).map((card) => card.key)).toEqual(["bonus", "unknown"]);
  setVote(state, state.cards[0], "pass", 124);
  expect(state.votes.get("test-relic")?.vote).toBe("pass");
  state.votes.delete("test-relic");
  expect(queue(state)[0].n).toBe("Test Relic");
});

it("ranks pod cards by bangs, then fewer bins, then recency, retaining voter names", () => {
  const vote = (key: string, value: "like" | "pass", at: number) =>
    ({ key, n: key, setName: "", vote: value, votedAt: at });
  const rows = boardRows([
    { name: "One", votes: [vote("b", "like", 3), vote("a", "like", 1), vote("c", "like", 2)] },
    { name: "Two", votes: [vote("a", "like", 1), vote("b", "pass", 4)] },
  ]);
  expect(rows.map((row) => row.key)).toEqual(["a", "c", "b"]);
  expect(rows[0].likes).toEqual(["One", "Two"]);
  expect(rows[2].passes).toEqual(["Two"]);
});
