// @vitest-environment happy-dom
// Behaviour tests for Key Pieces & Combos, Synergy, Track Record, Centrality and the explainers.
// A one-off check also compared the rendered panels with the old inline code (see the PR).

import { describe, expect, it } from "vitest";
import type { ComboDetail } from "../../engine/types.ts";
import { render } from "../../ui/html.ts";
import { comboStepsFor } from "./key-pieces/combo-steps.ts";
import { comboBracketLine, comboHow, comboMergedItems } from "./key-pieces/combo-text.ts";
import { keyPiecesTemplate, type KeyPiecesAgg } from "./key-pieces/key-pieces.ts";
import { gameChangerChipsHtml, linkifyKnownCardNames } from "./explainers/card-text.ts";
import { contributorsFor, type ContribAgg } from "./explainers/contributors.ts";
import { showExplainer, type ExplainerPorts } from "./explainers/index.ts";
import { ccKind, ccTileLabel } from "./centrality/glyphs.ts";
import { trackRecordTemplate } from "./synergy/track-record.ts";
import { strongestPairs } from "./synergy/sections.ts";

function combo(cards: string[], extra: Partial<ComboDetail> = {}): ComboDetail {
  return {
    cards,
    outcome: "infinite mana",
    infinite: true,
    bracketRelevant: true,
    winsAlone: false,
    commanderPiece: false,
    redundancy: 0,
    reliability: 1,
    totalCastCost: 4,
    pieceCosts: [2, 2],
    pieceCount: cards.length,
    matchedNames: [],
    ...extra,
  };
}

function mount(template: unknown): HTMLElement {
  const el = document.createElement("div");
  render(template, el);
  return el;
}

const ports = {
  comboCard: (name: string) => (name === "Isochron Scepter" ? { t: "Artifact", m: 2 } : null),
  spellbookDate: () => "2026-11-02T00:00:00Z",
  manaCurve: () => null,
  fetchImages: async () => ({ urlMap: { get: () => undefined, getOther: () => undefined } }),
};

const emptyAgg: KeyPiecesAgg = {
  gameChangers: [],
  fastManaCards: [],
  tutorCards: [],
  mldCards: [],
  staxCards: [],
  counterCards: [],
  commanders: [],
};

describe("combo text", () => {
  it("uses hand-written steps when every piece is present, accepting either alternative", () => {
    expect(comboStepsFor(["Kiki-Jiki, Mirror Breaker", "Deceiver Exarch"])).toMatch(
      /^Tap Kiki-Jiki/,
    );
    expect(comboStepsFor(["Kiki-Jiki, Mirror Breaker"])).toBeNull();
  });

  it("falls back to a template by outcome and says whether it finishes the game", () => {
    expect(comboHow("infinite mana", false)).toMatch(/makes more mana than it costs/);
    expect(comboHow("infinite mana", false)).toMatch(/usually needs a payoff to finish\.$/);
  });

  it("merges rows naming the same cards and lists wins before warps", () => {
    const items = comboMergedItems({
      detectedComboDetails: [
        combo(["A", "B"], { outcome: "infinite mana", comboClass: "warp" }),
        combo(["B", "A"], { outcome: "infinite storm count", comboClass: "warp" }),
        combo(["C", "D"], { outcome: "win the game", comboClass: "win" }),
      ],
      detectedCombos: ["a", "b", "c"],
    });
    expect(items.map((x) => x.d.cards)).toEqual([
      ["C", "D"],
      ["A", "B"],
    ]);
    expect(items[1]!.d.outcome).toBe("infinite mana and infinite storm count");
  });

  it("explains the bracket effect from piece count, payoff and speed", () => {
    expect(
      comboBracketLine({ pieceCount: 3, cards: [], bracketRelevant: true, winsAlone: true }, 3),
    ).toMatch(/none/);
    expect(
      comboBracketLine({ pieceCount: 2, cards: [], bracketRelevant: true, winsAlone: true }, 3),
    ).toMatch(/Bracket 4/);
    expect(
      comboBracketLine({ pieceCount: 2, cards: [], bracketRelevant: true, winsAlone: false }, 3),
    ).toMatch(/needs a payoff/);
  });
});

describe("Key Pieces & Combos", () => {
  it("is hidden when the deck has nothing to show", () => {
    expect(keyPiecesTemplate(ports, emptyAgg)).toBeNull();
  });

  it("lists combo lines with result, pieces, snapshot date and a picture row", () => {
    const el = mount(
      keyPiecesTemplate(ports, {
        ...emptyAgg,
        commanders: ["Isochron Scepter"],
        detectedComboDetails: [
          combo(["Isochron Scepter", "Dramatic Reversal"], {
            matchedNames: ["Isochron Scepter", "Dramatic Reversal"],
          }),
        ],
        detectedCombos: ["Isochron Scepter + Dramatic Reversal (infinite mana)"],
        staxCards: Array.from({ length: 13 }, (_, i) => "Tax " + i),
      }),
    );
    const block = el.querySelector(".kp-combo")!;
    expect(block.classList.contains("kp-combo-warp")).toBe(true);
    expect(block.querySelector(".kp-result")!.textContent).toBe("Result: Infinite mana");
    expect(block.querySelector(".kp-how-text")!.textContent).toMatch(/^Imprint Dramatic Reversal/);
    expect(block.querySelector(".kp-role")!.textContent).toBe(
      "Isochron Scepter – Your commander · Artifact · MV 2",
    );
    expect(JSON.parse(block.querySelector(".kp-thumbs")!.getAttribute("data-names")!)).toHaveLength(
      2,
    );
    expect(el.querySelector(".kp-footer")!.textContent).toContain("(snapshot of 2026-11-02)");
    expect(el.textContent).toContain("Tax 11…");
  });
});

const noCards: ContribAgg = {
  fastManaCards: [],
  rampCards: [],
  reanimateCards: [],
  tutorCards: [],
  protectionCards: [],
  staxCards: [],
  counterCards: [],
  discardCards: [],
  mldCards: [],
  gameChangers: [],
  detectedCombos: [],
};

describe("explainers", () => {
  it("escapes Game Changer chips and marks the ones with a reason", () => {
    expect(gameChangerChipsHtml(["Rhystic Study", "<b>"])).toBe(
      '<span class="gc-chip gc-chip-clickable" data-gc-card="Rhystic Study">Rhystic Study</span> <span class="gc-chip">&lt;b&gt;</span>',
    );
  });

  it("links the longest known name first without touching links already inserted", () => {
    const out = linkifyKnownCardNames("Ashling, the Extinguisher and Ashling", [
      "Ashling",
      "Ashling, the Extinguisher",
    ]);
    expect(out.match(/data-card-name="Ashling, the Extinguisher"/g)).toHaveLength(1);
    expect(out.match(/data-card-name="Ashling"/g)).toHaveLength(1);
  });

  it("lists contributing cards for an axis, capped and escaped", () => {
    const agg = {
      tutorCards: ["Demonic Tutor"],
      protectionCards: ["A", "B", "C", "D", "E", "F", "G"],
    } as Partial<ContribAgg>;
    const out = contributorsFor({ ...noCards, ...agg }, null, "consistency");
    expect(out).toContain("Tutors: ");
    expect(out).toContain('data-card-name="F"');
    expect(out).not.toContain('data-card-name="G"');
    expect(out).toContain("…");
  });

  it("opens the axis explainer with this deck's percentile", () => {
    const explainerPorts: ExplainerPorts = {
      agg: () => null,
      winCons: () => null,
      scores: () => ({ speed: 6.2 }),
      commandSpark: () => null,
      centrality: () => null,
      axes: () => [{ key: "speed", label: "Speed" }],
      sparkPercentile: () => 50,
      axisPercentile: () => 81,
      tierPlacement: () => "most precons",
      referenceSummary: () => "224 decks",
    };
    showExplainer(explainerPorts, "speed");
    const dialog = document.querySelector("#tadOverlay")!;
    expect(dialog.querySelector("h2")!.textContent).toBe("How was this built?");
    expect(dialog.querySelector(".ex-pct")!.textContent).toBe(
      "This deck's Speed of 6.2 sits at the 81st percentile of the PodMates reference set (224 decks, not all Commander decks). It scores higher than most precons.",
    );
    (dialog.querySelector("#tadCloseBtn") as HTMLElement).click();
  });
});

describe("Centrality and track record", () => {
  it("names a tile by card type, and a land by the colours it makes", () => {
    expect(ccKind("Artifact Creature — Golem")).toBe("creature");
    expect(ccTileLabel({ t: "Land", pm: "WG" })).toBe("Land, makes white/green");
  });

  it("shows tier rows and the build comparison", () => {
    const el = mount(
      trackRecordTemplate(
        [{ n: "Uril", t: "B", w: 24.56, g: 1500, r: 40 }],
        {
          direction: "underbuilt",
          tierRecord: { n: "Uril", t: "B", w: 24.56, g: 1500, r: 40 },
          detail: "Low for this commander.",
        },
        1284,
      ),
    );
    expect(el.querySelector(".tr-tier")!.className).toBe("tr-tier tr-tier-B");
    expect(el.querySelector(".tr-stats")!.textContent).toBe(
      "24.6% win rate · 1,500 tracked games · ranked #40 of 1,284",
    );
    expect(el.querySelector(".tr-disc")!.classList.contains("tr-under")).toBe(true);
  });

  it("keeps the strongest pairs in score order and escapes reasons", () => {
    const el = mount(
      strongestPairs([
        { a: "A", b: "B", score: 1, reasons: ["low"] },
        { a: "C", b: "D", score: 5, reasons: ["<script>"] },
      ]),
    );
    expect(el.querySelector(".syn-edge-why")!.textContent).toBe("<script>");
    expect(el.querySelectorAll("script")).toHaveLength(0);
  });
});
