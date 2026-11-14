// @vitest-environment happy-dom
import { beforeEach, expect, it } from "vitest";
import { chartedDeck, fillDeckForm, setChartedDeck } from "./deck-form";

beforeEach(() => {
  document.body.innerHTML = '<textarea id="decklistInput"></textarea><input id="commanderInput" />';
  setChartedDeck(null);
});

it("remembers the saved deck on the form until the form is refilled", () => {
  setChartedDeck({ uid: "u1", id: "d1", name: "Atraxa" });
  expect(chartedDeck()).toEqual({ uid: "u1", id: "d1", name: "Atraxa" });
  fillDeckForm({ decklist: "1 Sol Ring" });
  expect(chartedDeck()).toBeNull();
});

it("ignores incomplete references", () => {
  setChartedDeck({ uid: "", id: "d1", name: "x" });
  expect(chartedDeck()).toBeNull();
  setChartedDeck({ uid: "u1", id: "", name: "x" });
  expect(chartedDeck()).toBeNull();
});
