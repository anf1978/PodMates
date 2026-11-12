// @vitest-environment happy-dom
// Behaviour tests for the interaction reading and the "Cards you could add" sheet. A one-off
// check also compared these modules with the old inline code on 578 decks (see the PR).

import { describe, expect, it } from "vitest";
import type { MatchedCard } from "../../../cards/lookup.ts";
import type { CardRecord } from "../../../cards/tuple.ts";
import { render } from "../../../ui/html.ts";
import { buildInteractionPackages } from "./reading.ts";
import { ixDescribePackage } from "./describe.ts";
import { ixThinSpots } from "./knowledge.ts";
import { sheetTemplate } from "./sheet.ts";
import { buildInteractionSuggestions } from "./suggestions.ts";
import type { InteractionData, Knowledge } from "./types.ts";

function card(n: string, t: string, o = "", extra: Partial<CardRecord> = {}): CardRecord {
  return { n, t, o, c: "{1}{W}", ci: "W", m: 2, p: "", r: "common", g: false, b: false, ...extra };
}
const deck = (cards: CardRecord[]): MatchedCard[] =>
  cards.map((c) => ({ qty: 1, card: c, originalName: c.n }));

const tremors = card(
  "Impact Tremors",
  "Enchantment",
  "Whenever a creature you control enters, Impact Tremors deals 1 damage to each opponent.",
);
const blinker = card(
  "Ephemerate",
  "Instant",
  "Exile target creature you control, then return it to the battlefield under its owner's control.",
);
const bears = ["Ash Bear", "Birch Bear", "Cedar Bear", "Dune Bear"].map((n) =>
  card(n, "Creature — Bear"),
);
const commander = card("Captain Lumen", "Legendary Creature — Human Soldier", "Vigilance");
const noTags = { blink: new Set<string>(), extraCombat: new Set<string>() };
const emptyKnowledge: Knowledge = { json: { lists: [], cards: {} }, byName: new Map() };

describe("interaction reading", () => {
  it("finds a payoff with the cards that set it off and the ones that repeat it", () => {
    const data: InteractionData = { cards: [], tags: noTags };
    const reading = buildInteractionPackages(data, deck([commander, tremors, blinker, ...bears]), [
      commander.n,
    ]);
    const pk = reading.packages.find((p) => p.payoff === "Impact Tremors");
    expect(pk).toMatchObject({ kind: "trigger", event: "enters", effect: "drains or damages" });
    expect(pk?.objects).toEqual(expect.arrayContaining(bears.map((b) => b.n)));
    expect(pk?.repeaters).toEqual([{ name: "Ephemerate", how: "flickers them back in" }]);
  });

  it("describes a package with linked names and escaped card text", () => {
    const reading = buildInteractionPackages(
      { cards: [], tags: noTags },
      deck([tremors, blinker, ...bears]),
      [],
    );
    const pk = reading.packages.find((p) => p.payoff === "Impact Tremors")!;
    const markup = ixDescribePackage(pk, (n) => `[${n}]`);
    expect(markup).toContain(
      "<strong>[Impact Tremors]</strong> drains or damages whenever a creature enters.",
    );
    expect(markup).toContain("Sets it off again: [Ephemerate] (flickers them back in).");
  });

  it("reports core jobs below the precon floors", () => {
    expect(ixThinSpots({ ramp: 9, draw: 3, removal: 4 })).toEqual([
      { key: "draw", label: "Card draw", floor: 8, lists: ["best-card-draw"], have: 3 },
    ]);
    expect(ixThinSpots(null)).toEqual([]);
  });
});

describe("cards you could add", () => {
  it("only suggests legal cards in the commander's colours that the deck does not run", () => {
    const offColour = card("Blue Blink", "Instant", blinker.o, { ci: "U" });
    const banned = card("Banned Blink", "Instant", blinker.o, { b: true });
    const fresh = card("Cloudshift", "Instant", blinker.o, { m: 1 });
    const matched = deck([commander, tremors, ...bears, blinker]);
    const data: InteractionData = {
      cards: [commander, tremors, blinker, offColour, banned, fresh, ...bears],
      tags: noTags,
    };
    const reading = buildInteractionPackages(data, matched, [commander.n]);
    const result = buildInteractionSuggestions(data, emptyKnowledge, {
      matched,
      commanders: [commander.n],
      packages: reading.packages,
      axis: reading.axis,
      roles: {},
    });
    expect(result.identity).toBe("W");
    const names = result.items.flatMap((it) => it.groups.flatMap((g) => g.list.map((c) => c.n)));
    expect(names).toContain("Cloudshift");
    expect(names).not.toContain("Blue Blink");
    expect(names).not.toContain("Banned Blink");
    expect(names).not.toContain("Ephemerate");
  });

  it("renders the sheet with the New dimension heading once and the Game Changer warning", () => {
    const pick = { n: "Smothering Tithe", m: 4, why: "makes Treasure", g: true };
    const host = document.createElement("div");
    const items = [
      {
        title: "Impact Tremors",
        sub: "a creature enters",
        groups: [{ label: "Set it off again", list: [pick] }],
      },
      {
        title: "Your artifacts",
        sub: "you run 16",
        tag: "Feed what you make",
        dim: true,
        groups: [{ label: "Cheap artifact makers", list: [{ ...pick, n: "A", g: false }] }],
      },
      {
        title: "Your tokens",
        sub: "you run 9",
        tag: "Build it into a plan",
        dim: true,
        groups: [{ label: "More token makers", list: [{ ...pick, n: "B", g: false, m: 0 }] }],
      },
    ];
    render(
      sheetTemplate({ items, identity: "W" }, new Set(["impact tremors"]), emptyKnowledge, {
        key: "1-2",
        held: 0,
      }),
      host,
    );
    expect(host.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe(
      "Cards you could add",
    );
    expect(host.querySelectorAll(".ix-dim-head")).toHaveLength(1);
    expect(host.querySelectorAll(".ix-band-dim")).toHaveLength(2);
    const first = host.querySelector(".ix-item")!;
    expect(first.querySelector(".ix-band-tag")?.textContent).toBe("In your deck");
    expect(first.querySelector(".ix-band-sub")?.textContent).toBe("whenever a creature enters");
    expect(first.querySelector(".ix-group-label")?.textContent).toBe("Add: Set it off again");
    expect(first.querySelector(".ix-gc-warn")?.textContent).toBe(
      "⚠ Game Changer: adding it lifts this deck to Bracket 3",
    );
    expect(first.querySelector(".ix-pick-why")?.textContent).toBe("– makes Treasure, MV 4");
    expect(host.querySelectorAll(".ix-pick-why")[2]?.textContent).toBe("– makes Treasure");
  });

  it("says so when nothing fits", () => {
    const host = document.createElement("div");
    render(
      sheetTemplate({ items: [], identity: "" }, new Set(), emptyKnowledge, {
        key: undefined,
        held: 0,
      }),
      host,
    );
    expect(host.querySelector(".ix-empty")?.textContent).toBe(
      "No clear additions found for this deck's main interactions.",
    );
  });
});
