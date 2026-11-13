import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  changeDoc,
  decklistOf,
  existingSample,
  findNewPrecons,
  MTGJSON,
  reportMarkdown,
  slug,
  uniqueKey,
} from "./import-precons.mjs";

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const samples = json("../../public/data/TRY_A_DECK_OPTIONS.json");
const data = {
  cards: json("../../tests/golden/fixtures/cards.json"),
  spellbook: json("../../tests/golden/fixtures/spellbook.json"),
  winRates: json("../../tests/golden/fixtures/winrates.json"),
  fingerprints: json("../../public/data/PRECON_FINGERPRINTS.json"),
  metadata: json("../../public/data/TRY_A_DECK_METADATA.json"),
};

/** An MTGJSON deck file made from one of our real sample decks. */
function deckFileFrom(sample, name) {
  const lines = sample.decklist.split("\n").map((l) => l.match(/^(\d+)\s+(.+)$/));
  const commanders = sample.commander.split(" / ");
  const cards = lines.filter(Boolean).map(([, n, card]) => ({ name: card, count: Number(n) }));
  return {
    data: {
      name,
      commander: cards.filter((c) => commanders.includes(c.name)),
      mainBoard: cards.filter((c) => !commanders.includes(c.name)),
    },
  };
}

describe("helpers", () => {
  it("slugs names and keeps keys unique", () => {
    expect(slug("Science!")).toBe("science");
    expect(slug("Mind Flayarrrs")).toBe("mindflayarrrs");
    const entry = { name: "Science!", releaseDate: "2024-03-08" };
    expect(uniqueKey(entry, samples)).toBe("cmd2024-science-2");
    expect(uniqueKey({ name: "Brand New", releaseDate: "2027-02-01" }, samples)).toBe(
      "cmd2027-brandnew",
    );
  });

  it("writes commanders first and joins partners with a slash", () => {
    const deck = {
      commander: [
        { name: "A", count: 1 },
        { name: "B", count: 1 },
      ],
      mainBoard: [
        { name: "Sol Ring", count: 1 },
        { name: "Island", count: 97 },
        { name: "Nothing", count: 0 },
      ],
    };
    expect(decklistOf(deck)).toEqual({
      commander: "A / B",
      decklist: "1 A\n1 B\n1 Sol Ring\n97 Island",
      total: 100,
    });
  });

  it("recognises decks Try a Deck already has by name, key or commanders", () => {
    const fleet = samples.find((s) => s.key === "cmd2026-federationfleet");
    expect(
      existingSample({ name: "Federation Fleet", releaseDate: "2026-11-14" }, "", samples),
    ).toBe(fleet);
    expect(
      existingSample({ name: "Renamed", releaseDate: "2026-11-14" }, fleet.commander, samples),
    ).toBe(fleet);
    expect(existingSample({ name: "Unknown", releaseDate: "2026-11-14" }, "Nobody", samples)).toBe(
      undefined,
    );
  });
});

describe("findNewPrecons", () => {
  const science = samples.find((s) => s.key === "cmd2024-science");
  const others = samples.filter((s) => s.key !== "cmd2024-science");
  const list = {
    data: [
      {
        code: "TST",
        fileName: "BrandNew_TST",
        name: "Brand New",
        releaseDate: "2026-12-01",
        type: "Commander Deck",
      },
      {
        code: "TST",
        fileName: "Fleet_TST",
        name: "Federation Fleet",
        releaseDate: "2026-11-14",
        type: "Commander Deck",
      },
      {
        code: "TST",
        fileName: "Future_TST",
        name: "Future Deck",
        releaseDate: "2027-03-01",
        type: "Commander Deck",
      },
      {
        code: "TST",
        fileName: "Missing_TST",
        name: "Missing Cards",
        releaseDate: "2026-12-01",
        type: "Commander Deck",
      },
      {
        code: "TST",
        fileName: "Short_TST",
        name: "Short Deck",
        releaseDate: "2026-12-01",
        type: "Commander Deck",
      },
      {
        code: "OLD",
        fileName: "Old_OLD",
        name: "Old Deck",
        releaseDate: "2020-01-01",
        type: "Commander Deck",
      },
      {
        code: "TST",
        fileName: "Starter_TST",
        name: "A Starter",
        releaseDate: "2026-12-01",
        type: "Starter Deck",
      },
    ],
  };
  const files = {
    BrandNew_TST: deckFileFrom(science, "Brand New"),
    Missing_TST: (() => {
      const d = deckFileFrom(science, "Missing Cards");
      d.data.commander = [{ name: "Totally Unknown Legend", count: 1 }];
      return d;
    })(),
    Short_TST: {
      data: { commander: [{ name: "X", count: 1 }], mainBoard: [{ name: "Island", count: 10 }] },
    },
  };
  const fetchJson = vi.fn(async (url) => {
    if (url === `${MTGJSON}/DeckList.json`) return list;
    if (url === `${MTGJSON}/SetList.json`) return { data: [{ code: "TST", name: "Test Set" }] };
    const name = decodeURIComponent(
      url
        .split("/")
        .pop()
        .replace(/\.json$/, ""),
    );
    return files[name] || null;
  });

  it("adds released, complete, unknown Commander decks with suggested labels", async () => {
    const { samples: next, report } = await findNewPrecons({
      ...data,
      fetchJson,
      wait: async () => {},
      samples: others,
      today: "2026-12-05",
    });
    expect(report.added.map((a) => a.key)).toEqual(["cmd2026-brandnew"]);
    const added = next.at(-1);
    expect(added).toMatchObject({
      key: "cmd2026-brandnew",
      flavorName: "Brand New",
      commander: science.commander,
      source: "precon",
      year: 2026,
      setName: "Test Set",
      addedAt: "2026-12-05",
      tagline: `A 2026 Commander precon from Test Set, led by ${science.commander}.`,
    });
    expect(added.archetype).toBe(science.archetype); // closest match is the deck it was copied from
    expect(added.style.endsWith(added.archetype)).toBe(true);
    expect(added.decklist.split("\n")[0]).toBe(`1 ${science.commander}`);
    expect(next.slice(0, -1)).toEqual(others);
    expect(report.present).toEqual([{ name: "Federation Fleet", key: "cmd2026-federationfleet" }]);
    expect(report.waiting.map((w) => w.name)).toEqual(["Missing Cards", "Future Deck"]);
    expect(report.skipped.map((s) => s.name)).toEqual(["Short Deck"]);
    // Old and non-Commander decks are never fetched; the future one is not fetched either.
    const fetched = fetchJson.mock.calls.map(([url]) => url);
    expect(fetched.some((u) => /Old_OLD|Starter_TST|Future_TST|Fleet_TST/.test(u))).toBe(false);
    const md = reportMarkdown(report);
    expect(md).toContain("**Brand New** (Test Set)");
    expect(md).toContain("### Waiting (picked up on a later run)");
  });

  it("refuses malformed MTGJSON lists", async () => {
    await expect(
      findNewPrecons({ ...data, samples, today: "2026-12-05", fetchJson: async () => ({}) }),
    ).rejects.toThrow("MTGJSON lists missing or malformed");
  });
});

it("writes a change doc with every heading the change-doc test requires", () => {
  const doc = changeDoc(
    {
      added: [
        {
          flavorName: "Brand New",
          setName: "Test Set",
          key: "cmd2026-brandnew",
          commander: "Someone",
          archetype: "Voltron",
        },
      ],
    },
    41,
    "2026-12-05",
  );
  expect(doc.startsWith("# 041: Add 1 new precon to Try a Deck\n\nDate: 2026-12-05\n")).toBe(true);
  for (const heading of [
    "Summary",
    "What users see",
    "How it works",
    "Testing",
    "Risks and rollback",
    "Follow-ups",
    "Related",
  ])
    expect(doc).toContain(`\n## ${heading}\n`);
  expect(doc).toContain("**Brand New** (Test Set), `cmd2026-brandnew`: Someone; Voltron.");
});
