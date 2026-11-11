// @vitest-environment happy-dom
// Behaviour tests for the result panels' text. A one-off check also compared the rendered panels
// with the old inline code (see the PR).

import { describe, expect, it } from "vitest";
import type { BracketResult } from "../../../engine/brackets.ts";
import { render } from "../../../ui/html.ts";
import type { TemplateResult } from "../../../ui/html.ts";
import { bracketTemplate, type BracketAgg } from "./bracket.ts";
import { archetypeMatchTemplate, tableFeelTemplate, winConditionTemplate } from "./callouts.ts";
import { notFoundTemplate } from "./notices.ts";

function paint(template: TemplateResult): HTMLElement {
  const host = document.createElement("div");
  render(template, host);
  return host;
}

function agg(extra: Partial<BracketAgg> = {}): BracketAgg {
  return {
    gameChangers: [],
    detectedCombos: [],
    detectedComboDetails: [],
    comboNear: [],
    infiniteLoopTwoCard: [],
    bannedCards: [],
    ...extra,
  } as BracketAgg;
}

const bracket: BracketResult = {
  bracket: "3",
  bracketKey: "upgraded",
  spirit: { band: "Core", detail: "d", why: "w", signals: [] },
  reasoning: ["**Two** Game Changers.", "No fast mana."],
  note: null,
};

describe("win condition", () => {
  it("links named cards, escapes the detail and lists the other readings", () => {
    const host = paint(
      winConditionTemplate([
        {
          label: "Combo",
          detail: "Thassa's Oracle <b>wins</b>",
          confidence: "high",
          cards: ["Thassa's Oracle"],
        },
        { label: "Voltron", detail: "Big", confidence: "fallback" },
      ]),
    );
    expect(host.querySelector(".value")?.textContent).toBe("Combohigh confidence");
    expect(host.querySelector('[data-card-name="Thassa\'s Oracle"]')).not.toBeNull();
    expect(host.querySelector(".detail b")).toBeNull();
    expect(host.querySelector(".rs-also-head")?.textContent).toBe("Also detected (1)");
    expect(host.querySelector(".rs-tag-gap")?.textContent).toBe("best guess");
  });
});

describe("closest match", () => {
  it("names the precon set only for precons", () => {
    const deck = {
      key: "a",
      archetype: "Tokens",
      flavorName: "Go Wide",
      commander: "X",
      source: "precon",
      setName: "C21",
    };
    const host = paint(
      archetypeMatchTemplate({ top: { key: "a", sim: 0.814, deck }, runnersUp: [] }),
    );
    expect(host.querySelector(".detail")?.textContent).toBe("Closest to Go Wide (X), C21.");
    expect(host.querySelector(".confidence-tag")?.textContent).toBe("81% overlap");
    const curated = paint(
      archetypeMatchTemplate({
        top: { key: "a", sim: 0.5, deck: { ...deck, source: "curated" } },
        runnersUp: [],
      }),
    );
    expect(curated.querySelector(".detail")?.textContent).toBe("Closest to Go Wide (X).");
    expect(paint(archetypeMatchTemplate(null)).querySelector(".value")?.textContent).toBe(
      "No strong signal",
    );
  });
});

describe("table vibe", () => {
  it("adds the deck's own reasons to the explanation", () => {
    const host = paint(
      tableFeelTemplate(
        { label: "Spike", you: "You", pod: "Pod", why: "fast" },
        { band: "Tuned", detail: "Craft", why: "", signals: [] },
      ),
    );
    expect(host.querySelector(".rs-pod")?.textContent).toBe("Your pod: Pod");
    expect(host.querySelector(".rs-craft .value")?.textContent).toBe("Tuned");
    expect(host.querySelector(".rs-how-body")?.textContent).toContain("For this deck: fast");
    expect(host.querySelector(".rs-how-body")?.textContent?.match(/For this deck/g)).toHaveLength(
      1,
    );
  });
});

describe("bracket", () => {
  it("strips markdown and counts wins, warps and loops", () => {
    const host = paint(
      bracketTemplate(
        bracket,
        agg({
          detectedCombos: ["a", "b", "c"],
          detectedComboDetails: [
            { comboClass: "win" },
            { comboClass: "warp" },
            { comboClass: "win" },
          ] as never,
          comboNear: [{}] as never,
          infiniteLoopTwoCard: [{}] as never,
          bannedCards: ["Mana Crypt", "Jeweled Lotus"],
        }),
      ),
    );
    expect(host.querySelector(".bracket-num")?.textContent).toBe("Bracket 3 ?");
    expect(host.querySelector(".reasoning")?.textContent).toBe("Two Game Changers. No fast mana.");
    expect(host.querySelector(".rs-line")?.textContent).toContain(
      " 3 lines (2 wins, 1 warp) plus 1 two-card infinite loop.",
    );
    expect(host.querySelector(".rs-combo-btn")?.textContent).toBe(
      "See each combo and how it works · 1 one card away",
    );
    expect(host.querySelectorAll(".rs-banned [data-card-name]")).toHaveLength(2);
  });

  it("offers loops alone when no combo is counted", () => {
    const host = paint(bracketTemplate(bracket, agg({ infiniteLoopTwoCard: [{}, {}] as never })));
    expect(host.querySelector(".rs-line")?.textContent).toBe(
      "Two-card infinite loops: 2.     See them",
    );
  });
});

describe("not found", () => {
  it("lists typo fixes and unmatched names as text", () => {
    const host = paint(
      notFoundTemplate(["<img>", "Foo"], [{ typed: "Sol Rng", matched: "Sol Ring" }]),
    );
    expect(host.querySelector(".fuzzy-note")?.textContent).toBe(
      'Auto-corrected 1 likely typo(s): "Sol Rng" → "Sol Ring"',
    );
    expect(host.querySelector("summary")?.textContent).toBe("2 cards not found");
    expect(host.querySelector("img")).toBeNull();
  });
});
