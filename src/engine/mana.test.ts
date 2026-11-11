import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CardRecord } from "../cards/tuple.ts";
import { analyzeManaFace, combineManaFaces } from "./mana.ts";
import type { ManaFace } from "./mana.ts";

type ManaLogic = {
  analyzeManaFace: typeof analyzeManaFace;
  combineManaFaces: typeof combineManaFaces;
};

// The database build computes `pm`/`rt` with its own copy of this logic; the engine
// falls back to the typed copy for older databases. Both must give the same answer.
function loadBuildCopy(): ManaLogic {
  const source = readFileSync(
    new URL("../../pipelines/card-db/build-card-db.mjs", import.meta.url),
    "utf8",
  );
  const start = "// ===== BEGIN SHARED MANA-PRODUCTION LOGIC =====";
  const end = "// ===== END SHARED MANA-PRODUCTION LOGIC =====";
  const block = source.slice(source.indexOf(start), source.indexOf(end));
  expect(block).toContain("function analyzeManaFace");
  return new Function(`${block}\nreturn { analyzeManaFace, combineManaFaces };`)() as ManaLogic;
}

describe("shared mana-production logic", () => {
  it("matches the database build's copy on every pinned card face", () => {
    const build = loadBuildCopy();
    const cards = JSON.parse(
      readFileSync(new URL("../../tests/golden/fixtures/cards.json", import.meta.url), "utf8"),
    ) as CardRecord[];
    expect(cards.length).toBeGreaterThan(1000);
    for (const card of cards) {
      const faces: [string, string][] = [[card.t, card.o]];
      if (card.bt || card.ob) faces.push([card.bt ?? "", card.ob ?? ""]);
      const ours: ManaFace[] = faces.map(([t, o]) => analyzeManaFace(t, o));
      expect(
        faces.map(([t, o]) => build.analyzeManaFace(t, o)),
        card.n,
      ).toEqual(ours);
      expect(build.combineManaFaces(ours), card.n).toEqual(combineManaFaces(ours));
    }
  });
});
