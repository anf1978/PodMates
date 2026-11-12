// Proposal validation, queue order and the standard-score isolation invariant.
import { expect, it } from "vitest";
import { analyzeDeck, createEngineContext, scorePowerLevel } from "../../engine";
import { DEFAULT_IMPACT_CARDS } from "../../data/impact-defaults";
import type { ImpactChange } from "../../services/cloud/types";
import {
  candidates,
  cleanChanges,
  computePodView,
  createState,
  effectiveList,
  impactKey,
  type Candidate,
} from "./state";

it("keeps only consistent proposals and deduplicates additions without editing defaults", () => {
  const first = DEFAULT_IMPACT_CARDS[0];
  const changes: Record<string, ImpactChange> = {
    [impactKey(first)]: { card: first.toUpperCase(), action: "remove", reason: "Too strong" },
    extra: { card: "Test Relic", action: "add" },
    duplicate: { card: "TEST RELIC", action: "add" },
    partial: { reason: "Partial merge" },
    invalidAdd: { card: first, action: "add" },
    invalidRemove: { card: "Other", action: "remove" },
    long: { card: "x".repeat(201), action: "add" },
  };
  const original = structuredClone(changes);
  expect(Object.keys(cleanChanges(changes))).toEqual([impactKey(first), "extra", "duplicate"]);
  const list = effectiveList(changes);
  expect(list).not.toContain(first);
  expect(list.filter((n) => n.toLowerCase() === "test relic")).toEqual(["Test Relic"]);
  expect(changes).toEqual(original);
  expect(effectiveList({})).toEqual(DEFAULT_IMPACT_CARDS);
});

it("excludes effective, default, dismissed and nominated ideas, then interleaves source lists", () => {
  const row = (name: string, source: string): Candidate => [name, source, 1, 10, 1, 0, ""];
  const state = createState();
  state.changes = { added: { card: "Added", action: "add" } };
  state.dismissed = { dismissed: { card: "Dismissed", by: "u", byName: "User", at: 1 } };
  state.nominations = [
    { id: "nominated", card: "Nominated", by: "u", byName: "User", at: 1, note: "" },
  ];
  const rows = [
    row(DEFAULT_IMPACT_CARDS[0], "A"),
    row("Added", "A"),
    row("Dismissed", "A"),
    row("Nominated", "A"),
    row("A1", "A"),
    row("A2", "A"),
    row("B1", "B"),
    row("B2", "B"),
  ];
  expect(candidates(rows, state).map((r) => r[0])).toEqual(["A1", "B1", "A2", "B2"]);
});

it("computes proposals on the side without changing the aggregate, standard Power or Spark", () => {
  const card = {
    n: "Test Relic",
    t: "Artifact",
    o: "",
    c: "{3}",
    ci: "",
    m: 3,
    p: "",
    r: "r",
    g: false,
    b: false,
  };
  const context = createEngineContext({ cards: [card], spellbook: null, winRates: [] });
  const agg = analyzeDeck(context, [{ qty: 1, card }]);
  const scores = Object.freeze({
    speed: 2,
    consistency: 3,
    versatility: 4,
    disruption: 5,
    powerLevel: scorePowerLevel(agg),
  });
  const chart = { agg, scores, spark: 3.2 };
  const before = structuredClone(chart);
  Object.freeze(agg);
  const view = computePodView(chart, { test_relic: { card: card.n, action: "add" } });
  expect(view!.power).toBeGreaterThan(scores.powerLevel);
  expect(view!.hits).toEqual([card.n]);
  expect(chart).toEqual(before);
  expect(scorePowerLevel(agg)).toBe(scores.powerLevel);
  expect(computePodView(null, {})).toBeNull();
});
