// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { facePair, fetchCardImagesBatch, type ScryfallCard } from "../../services/card-art";
import { groupDeck, typeTiles, viewerCategory } from "./state";
import { renderCommanderHero, showDeckViewer } from "./index";

const card = (n: string, t: string) => ({ n, t });
const art = (name: string): ScryfallCard => ({
  name,
  image_uris: { normal: `https://img/${name}` },
});

function stubCollection(respond: (names: string[]) => ScryfallCard[]) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const { identifiers } = JSON.parse(String(init?.body)) as { identifiers: { name: string }[] };
    return new Response(JSON.stringify({ data: respond(identifiers.map((i) => i.name)) }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("View Deck grouping", () => {
  it("puts each card in exactly one bucket, commanders first, by priority", () => {
    expect(viewerCategory("Artifact Creature — Golem")).toBe("Creature");
    expect(viewerCategory("Enchantment — Aura")).toBe("Enchantment");
    expect(viewerCategory("Kindred Tribal — Elf")).toBe("Other");

    const gallery = groupDeck(
      [
        { qty: 1, card: card("Zur", "Legendary Creature — Human") },
        { qty: 1, card: card("Forest", "Basic Land — Forest") },
        { qty: 1, card: card("Sol Ring", "Artifact") },
        { qty: 2, card: card("Forest", "Basic Land — Forest") },
        { qty: 1, card: card("Bear", "Creature — Bear") },
      ],
      new Set(["Zur"]),
    );
    expect(gallery.names).toEqual(["Zur", "Forest", "Sol Ring", "Bear"]);
    expect(gallery.groups.map((g) => [g.name, g.count])).toEqual([
      ["Commander", 1],
      ["Creature", 1],
      ["Artifact", 1],
      ["Land", 3],
    ]);
  });

  it("sums a type row's repeated entries and sorts them", () => {
    expect(
      typeTiles([
        { name: "b", qty: 1 },
        { name: "a", qty: 1 },
        { name: "b", qty: 2 },
      ]),
    ).toEqual([
      { name: "a", qty: 1 },
      { name: "b", qty: 3 },
    ]);
  });
});

describe("card art", () => {
  it("returns the requested face first and the other face only for two-image cards", () => {
    const dfc: ScryfallCard = {
      name: "Front // Back",
      card_faces: [
        { name: "Front", image_uris: { normal: "f" } },
        { name: "Back", image_uris: { normal: "b" } },
      ],
    };
    expect(facePair(dfc, "Back")).toEqual(["b", "f"]);
    expect(facePair(dfc, "Front // Back")).toEqual(["f", "b"]);
    expect(facePair({ ...art("Split"), card_faces: [{ name: "A" }, { name: "B" }] }, "A")).toEqual([
      "https://img/Split",
      null,
    ]);
  });

  it("matches names case-insensitively and retries split cards by their front face", async () => {
    const fetchMock = stubCollection((names) =>
      names.filter((n) => n !== "Fire // Ice" && n !== "Nope").map((n) => art(n.toUpperCase())),
    );
    const { urlMap, notFound } = await fetchCardImagesBatch(["Sol Ring", "Fire // Ice", "Nope"]);
    expect(urlMap.get(" sol ring ")).toBe("https://img/SOL RING");
    expect(urlMap.get("Fire // Ice")).toBe("https://img/FIRE");
    expect(notFound).toEqual(["Nope"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("views", () => {
  it("renders View Deck groups with art, quantities and a placeholder for missing art", async () => {
    stubCollection((names) => names.filter((n) => n !== "Bear").map(art));
    await showDeckViewer(
      [
        { qty: 1, card: card("Zur", "Legendary Creature — Human") },
        { qty: 3, card: card("Forest", "Basic Land — Forest") },
        { qty: 1, card: card("Bear", "Creature — Bear") },
      ],
      new Set(["Zur"]),
    );
    const modal = document.querySelector(".tad-modal")!;
    expect(modal.querySelector("h2")?.textContent).toBe("View Deck");
    expect(modal.querySelector(".cv-summary")?.textContent).toBe(
      "3 card lines · 1 card shown without art",
    );
    expect([...modal.querySelectorAll(".cv-section-title")].map((e) => e.textContent)).toEqual([
      "Commander (1)",
      "Creature (1)",
      "Land (3)",
    ]);
    expect(modal.querySelector(".cv-qty")?.textContent).toBe("×3");
    expect(modal.querySelector(".cv-placeholder")?.textContent).toBe("Bear");
  });

  it("shows only the commanders whose art was found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("Missing")
          ? new Response("", { status: 404 })
          : new Response(JSON.stringify(art("Zur"))),
      ),
    );
    const area = document.createElement("div");
    await renderCommanderHero(area, ["Zur", "Missing", "Third"]);
    const slots = area.querySelectorAll(".cv-hero-slot");
    expect(slots).toHaveLength(2);
    expect([...slots].map((s) => s.classList.contains("cv-shown"))).toEqual([true, false]);
    expect(area.querySelector("img")?.getAttribute("src")).toBe("https://img/Zur");
  });
});
