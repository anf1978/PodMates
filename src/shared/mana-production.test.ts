// Fixed vectors taken from the card-database build before its copy of this logic was merged with the engine's.
// The digest covers the 7621 originally pinned card faces (the precon importer only appends cards after them):
// a change here changes `pm`/`rt` in the next published card database.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CardRecord } from "../cards/tuple.ts";
import { analyzeManaFace, combineManaFaces, type ManaFace } from "./mana-production.ts";

const CARDS = JSON.parse(
  readFileSync(new URL("../../tests/golden/fixtures/cards.json", import.meta.url), "utf8"),
) as CardRecord[];

function produce(card: CardRecord): [string, ManaFace[], { pm: string; rt: 0 | 1 }] {
  const faces: [string, string][] = [[card.t, card.o]];
  if (card.bt || card.ob) faces.push([card.bt ?? "", card.ob ?? ""]);
  const results = faces.map(([t, o]) => analyzeManaFace(t, o));
  return [card.n, results, combineManaFaces(results)];
}

describe("mana production", () => {
  it.each([
    ["Sol Ring", "C", 0],
    ["Llanowar Elves", "G", 0],
    ["Dark Ritual", "B", 1],
    ["Command Tower", "WUBRG", 0],
    ["Lotus Petal", "WUBRG", 1],
    ["Birds of Paradise", "WUBRG", 0],
    ["Arcane Signet", "WUBRG", 0],
  ] as const)("%s makes %s (one-shot: %i)", (name, pm, rt) => {
    const card = CARDS.find((c) => c.n === name);
    expect(card, name).toBeDefined();
    expect(produce(card!)[2]).toEqual({ pm, rt });
  });
  it("keeps every pinned card face's result", () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(7621);
    const digest = createHash("sha256")
      .update(JSON.stringify(CARDS.slice(0, 7621).map(produce)))
      .digest("hex");
    expect(digest).toBe("9faa7c16adaf1386c56afec2dace2533440076881b2adf13ac3368942182a98f");
  });
  it("prefers sustained mana over a one-shot ability", () => {
    expect(
      combineManaFaces([
        { sustained: "R", oneShot: "" },
        { sustained: "", oneShot: "G" },
      ]),
    ).toEqual({ pm: "R", rt: 0 });
  });
});
