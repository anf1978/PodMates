import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { decodeCardDatabase, decodeCardRecords } from "./db-codec.js";
import { buildLookupIndexes } from "./lookup.ts";

it("preserves old tuple omissions, new face fields, and legality flags", () => {
  const cards = decodeCardRecords({
    gc: ["Front // Back"],
    banned: ["Old"],
    cards: [
      ["Old", "Artifact", "", "{2}", "", 2, "", "common"],
      [
        "Front // Back",
        "Creature",
        "front",
        "{G}",
        "G",
        1,
        "G",
        "rare",
        "G",
        1,
        "*",
        "2",
        1,
        "3",
        "back",
        "Land",
      ],
    ],
  });
  expect(cards[0]).toMatchObject({ g: false, b: true });
  for (const key of ["pm", "rt", "pw", "tg", "x", "ly", "ob", "bt"]) {
    expect(cards[0]).toHaveProperty(key, undefined);
  }
  expect(cards[1]).toMatchObject({
    pm: "G",
    rt: true,
    pw: "*",
    tg: "2",
    x: true,
    ly: "3",
    ob: "back",
    bt: "Land",
    g: true,
    b: false,
  });
});

it("preserves first face aliases, last exact matches, case folding, and cloned card identity", () => {
  const cards = decodeCardRecords({
    gc: [],
    banned: [],
    cards: ["Front // Back", "Front // Other", "Third // Back", "FRONT // BACK"].map((name) => [
      name,
      "",
      "",
      "",
      "",
      0,
      "",
      "",
    ]),
  });
  const indexes = buildLookupIndexes(cards);
  expect(indexes.byExactName.get("front // back")).toBe(cards[3]);
  expect(indexes.byFrontFaceName.get("front")).toBe(cards[0]);
  expect(indexes.byBackFaceName.get("back")).toBe(cards[0]);
  const cloned = structuredClone({
    cards,
    entries: [...indexes.byExactName],
  });
  expect(new Map(cloned.entries).get("front // back")).toBe(cloned.cards[3]);
});

it("decodes the published DB without changing any pinned card record", async () => {
  const compressed = JSON.parse(
    readFileSync(new URL("../../public/data/cards.json", import.meta.url), "utf8"),
  ) as string;
  const pinned: { n: string }[] = JSON.parse(
    readFileSync(new URL("../../tests/golden/fixtures/cards.json", import.meta.url), "utf8"),
  );
  const cards = await decodeCardDatabase(compressed);
  const indexes = buildLookupIndexes(cards);
  expect(
    JSON.parse(JSON.stringify(pinned.map((card) => indexes.byExactName.get(card.n.toLowerCase())))),
  ).toEqual(pinned);
});

it("rejects truncated compressed data and empty databases", async () => {
  await expect(decodeCardDatabase("H4sI")).rejects.toThrow("Could not decompress card database");
  const compressed = await new Response(
    new Blob(['{"gc":[],"banned":[],"cards":[]}'])
      .stream()
      .pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
  await expect(decodeCardDatabase(Buffer.from(compressed).toString("base64"))).rejects.toThrow(
    "CARD_DB missing or empty",
  );
});
