import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";
import { build } from "./build-card-db.mjs";

const directories = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

function fixture() {
  const creature = {
    object: "card",
    name: "Fixture Druid",
    type_line: "Creature",
    oracle_text: "{T}: Add {G}.",
    mana_cost: "{G}",
    color_identity: ["G"],
    cmc: 1,
    rarity: "common",
    power: "1",
    toughness: "2",
    legalities: { commander: "legal" },
  };
  const cards = Array.from({ length: 5000 }, (_, i) => ({
    ...creature,
    name: `Druid ${i}`,
    game_changer: i === 0,
    legalities: { commander: i < 300 ? "not_legal" : i === 300 ? "banned" : "legal" },
  }));
  cards.push(
    ...Array.from({ length: 300 }, (_, i) => ({
      ...creature,
      name: `Walker ${i}`,
      type_line: "Planeswalker",
      loyalty: "4",
    })),
  );
  cards.push(
    ...Array.from({ length: 800 }, (_, i) => ({
      ...creature,
      name: `Front ${i} // Back ${i}`,
      layout: "modal_dfc",
      card_faces: [
        { type_line: "Creature", oracle_text: "{T}: Add {G}." },
        { type_line: "Land", oracle_text: "{T}: Add {U}." },
      ],
    })),
  );
  return [
    ...cards,
    cards[0],
    { ...creature, layout: "token" },
    { ...creature, layout: "art_series" },
  ];
}

function paths() {
  const directory = mkdtempSync(join(tmpdir(), "podmates-card-builder-"));
  directories.push(directory);
  return { input: join(directory, "input.bin"), output: join(directory, "output.b64") };
}

describe("card database builder", () => {
  it.each([false, true])("builds the published tuple payload from gzip=%s input", (compressed) => {
    const { input, output } = paths();
    const text = `[\n${fixture()
      .map((card) => JSON.stringify(card))
      .join(",\n")}\n]\n`;
    writeFileSync(input, compressed ? gzipSync(text) : text);
    // Exercise the real CLI on Windows as well as importing the builder without running it.
    execFileSync(process.execPath, [
      fileURLToPath(new URL("./build-card-db.mjs", import.meta.url)),
      input,
      output,
    ]);
    const payload = JSON.parse(gunzipSync(Buffer.from(readFileSync(output, "utf8"), "base64")));
    expect(payload.cards).toHaveLength(6100);
    expect(payload.cards[0]).toEqual([
      "Druid 0",
      "Creature",
      "{T}: Add {G}.",
      "{G}",
      "G",
      1,
      "G2",
      "common",
      "G",
      0,
      "1",
      "2",
      1,
      "",
      "",
      "",
    ]);
    expect(payload.cards.find((card) => card[0] === "Walker 0")[13]).toBe("4");
    expect(payload.cards.find((card) => card[0] === "Front 0 // Back 0")).toEqual([
      "Front 0 // Back 0",
      "Creature",
      "{T}: Add {G}.",
      "{G}",
      "G",
      1,
      "G2",
      "common",
      "UG",
      0,
      "1",
      "2",
      0,
      "",
      "{T}: Add {U}.",
      "Land",
    ]);
    expect(payload.gc).toEqual(["Druid 0"]);
    expect(payload.banned).toEqual(["Druid 300"]);
  });

  it.each(["{broken", "[\n]\n"])("rejects malformed or implausibly empty input: %s", (text) => {
    const { input, output } = paths();
    writeFileSync(input, text);
    writeFileSync(output, "previous database");
    expect(() => build(input, output)).toThrow();
    expect(readFileSync(output, "utf8")).toBe("previous database");
  });

  it("does not silently skip a malformed row in an otherwise plausible database", () => {
    const { input, output } = paths();
    writeFileSync(
      input,
      `${fixture()
        .map((card) => JSON.stringify(card))
        .join("\n")}\n{broken`,
    );
    expect(() => build(input, output)).toThrow(/Malformed card input at line/);
  });

  it("rejects corrupt gzip before writing output", () => {
    const { input, output } = paths();
    writeFileSync(input, Buffer.from([0x1f, 0x8b, 0, 0]));
    expect(() => build(input, output)).toThrow();
  });
});
