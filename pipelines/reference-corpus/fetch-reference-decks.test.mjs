import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  commanderKey,
  countCards,
  parseEdhrecAverage,
  parseEdhtop16Decklist,
  parseEdhtop16Entries,
  pickBestEntry,
  primersFor,
  toDecklist,
} from "./fetch-reference-decks.mjs";

const entry = (standing, size, date, id) =>
  `{"node":{"id":"x","standing":${standing},"wins":5,"losses":1,"draws":2,` +
  `"decklist":"https:\\u002F\\u002Ftopdeck.gg\\u002Fdeck\\u002Fev\\u002F${id}",` +
  `"decklistUrl":"\\u002Ftournament\\u002Fev\\u002Fdecklist\\u002F${id}","priceUsd":1,` +
  `"player":{"name":"Someone","team":null},` +
  `"tournament":{"name":"Event ${id} ","size":${size},"tournamentDate":"${date}T10:00:00.000Z","TID":"ev"}}}`;

describe("EDHTop16 parsing", () => {
  it("reads entries and picks the best finish, then the larger, then the more recent event", () => {
    const html = [
      entry(2, 300, "2026-06-01", "a"),
      entry(1, 120, "2026-05-01", "b"),
      entry(1, 120, "2026-07-01", "c"),
      entry(1, 40, "2026-08-01", "d"),
      entry(1, 120, "2026-07-01", "c"),
    ].join(",");
    const entries = parseEdhtop16Entries(html);
    expect(entries).toHaveLength(4);
    expect(entries[0]).toMatchObject({
      standing: 2,
      record: "5-1-2",
      event: "Event a",
      size: 300,
      date: "2026-06-01",
      decklistUrl: "/tournament/ev/decklist/a",
      originalList: "https://topdeck.gg/deck/ev/a",
    });
    expect(pickBestEntry(entries)?.decklistUrl).toBe("/tournament/ev/decklist/c");
    expect(pickBestEntry([])).toBeNull();
  });

  it("reads each decklist card once with its count", () => {
    const card = (n, name) =>
      `{"count":${n},"spice":0,"commanderPlayRate":0.5,"card":{"id":"Q","name":"${name}","type":"x"}}`;
    const html = [
      card(1, "Sol Ring"),
      card(3, "Island"),
      card(1, "Sol Ring"),
      card(1, "Fire // Ice"),
    ];
    expect(parseEdhtop16Decklist(html.join(","))).toEqual([
      ["Fire // Ice", 1],
      ["Island", 3],
      ["Sol Ring", 1],
    ]);
  });
});

describe("EDHREC average decks", () => {
  it("flattens the card groups, commanders first", () => {
    const parsed = parseEdhrecAverage({
      header: "Average Deck for Korvold - Optimized",
      deck: {
        commander: ["Korvold, Fae-Cursed King"],
        cards: { Land: [["Forest", 5]], Artifact: [["Sol Ring", 1]] },
      },
    });
    const text = toDecklist(parsed);
    expect(text).toBe("1 Korvold, Fae-Cursed King\n5 Forest\n1 Sol Ring\n");
    expect(countCards(text)).toBe(7);
  });

  it("throws on a response without a deck", () => {
    expect(() => parseEdhrecAverage({ header: "x" })).toThrow();
  });
});

describe("primer links", () => {
  it("matches partner pairs in either order and keeps only lists with primers", () => {
    const ddb = [
      {
        title: "Blue Farm",
        section: "COMPETITIVE",
        updated: "2026-01-02T00:00:00Z",
        commander: [{ name: "Tymna the Weaver" }, { name: "Kraum, Ludevic's Opus" }],
        decklists: [
          { title: "Primer list", link: "https://example.test/p", primer: true },
          { title: "No primer", link: "https://example.test/n", primer: false },
        ],
      },
      { title: "Other", section: "COMPETITIVE", commander: [{ name: "Kinnan, Bonder Prodigy" }] },
    ];
    expect(primersFor(ddb, "Kraum, Ludevic's Opus / Tymna the Weaver")).toEqual([
      {
        title: "Primer list",
        url: "https://example.test/p",
        database: "Blue Farm (COMPETITIVE)",
        updated: "2026-01-02",
      },
    ]);
    expect(commanderKey("Ral, Monsoon Mage // Ral, Leyline Prodigy")).toBe("ral monsoon mage");
  });
});

describe("committed corpus", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("./reference-decks.json", import.meta.url), "utf8"),
  );

  it("has a 100-card list file for every deck in the manifest", () => {
    expect(manifest.decks.filter((d) => d.tier === "t")).toHaveLength(30);
    expect(manifest.decks.filter((d) => d.tier === "c")).toHaveLength(20);
    for (const deck of manifest.decks) {
      const dir = deck.tier === "t" ? "tuned" : "cedh";
      const text = readFileSync(new URL(`./decks/${dir}/${deck.key}.txt`, import.meta.url), "utf8");
      expect(countCards(text), deck.key).toBe(100);
      expect(deck.cardCount, deck.key).toBe(100);
      expect(deck.source?.url, deck.key).toMatch(/^https:\/\//);
      expect(deck.archetype, deck.key).toBeTruthy();
    }
  });
});
