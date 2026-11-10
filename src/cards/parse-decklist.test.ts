import { expect, it } from "vitest";
import { parseDecklist, parseDecklistLine } from "./parse-decklist.ts";

it("ignores blank lines and section headers, whatever their case or punctuation", () => {
  for (const line of [
    "",
    "   ",
    "\t",
    "Deck",
    "Deck:",
    "decks:",
    "Sideboard:",
    "COMMANDER",
    "Maybeboard:",
  ]) {
    expect(parseDecklistLine(line)).toBeNull();
  }
});

it("reads every quantity prefix the exports use, and only a real one", () => {
  expect(parseDecklistLine("Sol Ring")).toEqual({ qty: 1, name: "Sol Ring" });
  expect(parseDecklistLine("1 Sol Ring")).toEqual({ qty: 1, name: "Sol Ring" });
  expect(parseDecklistLine("4x Lightning Bolt")).toEqual({ qty: 4, name: "Lightning Bolt" });
  expect(parseDecklistLine("12X Island")).toEqual({ qty: 12, name: "Island" });
  expect(parseDecklistLine("  3   Forest  ")).toEqual({ qty: 3, name: "Forest" });
  // "0 Plains" keeps a usable quantity; a prefix with no space is part of the name.
  expect(parseDecklistLine("0 Plains")).toEqual({ qty: 1, name: "Plains" });
  expect(parseDecklistLine("4xLightning Bolt")).toEqual({ qty: 1, name: "4xLightning Bolt" });
});

it("strips foil markers, bracketed sets and set code plus collector number", () => {
  expect(parseDecklistLine("1 Sol Ring *F*")?.name).toBe("Sol Ring");
  expect(parseDecklistLine("1 Sol Ring [LTC]")?.name).toBe("Sol Ring");
  expect(parseDecklistLine("1 Sol Ring (LTC) 123")?.name).toBe("Sol Ring");
  expect(parseDecklistLine("1 Sol Ring (C21)")?.name).toBe("Sol Ring");
  // Moxfield puts the foil marker after the collector number; both must come off.
  expect(parseDecklistLine("1 As Foretold (WHO) 805 *F*")?.name).toBe("As Foretold");
  expect(parseDecklistLine("1 Arcane Signet [LTC] (LTC) 304 *F*")?.name).toBe("Arcane Signet");
  expect(parseDecklistLine("Dusk // Dawn (AKH) 210")?.name).toBe("Dusk // Dawn");
});

it("peels at most five passes of annotations and drops a line left empty", () => {
  expect(parseDecklistLine("Card [A] [B] [C] [D] [E] [F]")?.name).toBe("Card [A]");
  expect(parseDecklistLine("*F*")).toBeNull();
  expect(parseDecklistLine("2 [LTC]")).toBeNull();
});

it("collects commander names only while a Commander section is open", () => {
  const parsed = parseDecklist(
    ["Commander:", "1 Atraxa, Praetors' Voice", "", "Deck", "1 Sol Ring", "1 Arcane Signet"].join(
      "\n",
    ),
  );
  expect(parsed.commanderNames).toEqual(["Atraxa, Praetors' Voice"]);
  expect(parsed.entries).toEqual([
    { qty: 1, name: "Atraxa, Praetors' Voice" },
    { qty: 1, name: "Sol Ring" },
    { qty: 1, name: "Arcane Signet" },
  ]);
});

it("closes the commander section on any board header and handles CRLF input", () => {
  for (const header of ["Deck:", "Sideboard", "Maybeboard:", "Mainboard"]) {
    const parsed = parseDecklist(
      ["Commanders:", "1 Tymna the Weaver", header, "1 Sol Ring"].join("\r\n"),
    );
    expect(parsed.commanderNames).toEqual(["Tymna the Weaver"]);
    expect(parsed.entries).toHaveLength(2);
  }
});

it("returns no commanders for a plain list", () => {
  const parsed = parseDecklist("1 Sol Ring\n1 Island\n");
  expect(parsed.commanderNames).toEqual([]);
  expect(parsed.entries).toHaveLength(2);
});
