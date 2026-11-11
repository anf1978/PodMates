// State thresholds and real comparison/detail lifecycle with a small engine-derived deck.
// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cardFromTuple } from "../../cards/tuple";
import { buildLookupIndexes } from "../../cards/lookup";
import { createEngineContext } from "../../engine";
import { analyzeList } from "../../services/deck-analysis";
import { closeTryADeckModal } from "../../ui/tad-modal";
import {
  tableState,
  analyzePaceInteractionRisks,
  generatePodSummary,
  type ComparisonDeck,
} from "./state";
import { buildBalanceNudges } from "./guidance";
import { mount } from "./index";
const cards = [
  cardFromTuple(["Sol Ring", "Artifact", "{T}: Add {C}{C}.", "{1}", "", 1, "", "u"], {
    gameChanger: false,
    banned: false,
  }),
];
const input = {
  context: createEngineContext({ cards, spellbook: null, winRates: [] }),
  indexes: buildLookupIndexes(cards),
  detectCommander: () => [],
};
function deck(name: string, spark: number): ComparisonDeck {
  return {
    ...analyzeList("1 Sol Ring", "", "", input)!,
    name,
    commanderLabel: name,
    commandSpark: spark,
    color: "#E0B24D",
  };
}
afterEach(() => {
  closeTryADeckModal();
  document.body.replaceChildren();
});
it("sorts without mutating input and preserves alignment/nudge thresholds", () => {
  const a = deck("A", 4),
    b = deck("B", 4.7),
    original = [a, b];
  const state = tableState(original);
  expect(original).toEqual([a, b]);
  expect(state.decks).toEqual([b, a]);
  expect(state.label).toBe("Well Balanced");
  expect(buildBalanceNudges([a, deck("Close", 4.69)])?.skipReason).toContain("already close");
  expect(buildBalanceNudges(original)?.high?.label).toBe("B");
  expect(tableState([a, deck("High", 6)]).label).toBe("High Variance");
});
it("identifies sudden and low-agency tables without changing any score", () => {
  const fast = deck("Fast", 5),
    quiet = deck("Quiet", 5),
    control = deck("Control", 5);
  fast.pace = 9;
  quiet.pace = control.pace = 3;
  fast.scores.disruption = control.scores.disruption = 7;
  quiet.scores.disruption = 2;
  const risks = analyzePaceInteractionRisks([fast, quiet, control]);
  expect(risks).toHaveLength(3);
  expect(risks[0]).toContain("could end the game before Quiet and Control");
  expect(risks[1]).toContain("long, low-agency night");
  expect(risks[2]).toContain("Quiet has very low interaction");
  expect(generatePodSummary([fast, quiet, control])).toContain("strong disruption");
});
it("escapes player/deck text, opens the sorted deck and cancels dismissed async details", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  host.scrollIntoView = vi.fn();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const view = mount(host, { loadDatasets: () => pending, archetype: () => null });
  const first = deck("<b>A</b>", 6),
    second = deck("B", 4);
  view.show([second, first]);
  expect(host.querySelector("#podRankArea b")).toBeNull();
  host.querySelector<HTMLElement>("[data-pod-deck-index]")!.click();
  expect(document.querySelector("#tadOverlay")?.textContent).toContain("Loading...");
  closeTryADeckModal();
  release();
  await pending;
  await Promise.resolve();
  expect(document.querySelector("#tadOverlay")).toBeNull();
  host.querySelector<HTMLElement>("[data-pod-deck-index]")!.click();
  await Promise.resolve();
  expect(document.querySelector("#tadOverlay h2")?.textContent).toBe("<b>A</b>");
  view.destroy();
  expect(host.textContent).toBe("");
});
