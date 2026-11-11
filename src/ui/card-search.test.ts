// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { wireCardSearch, type SearchCard } from "./card-search";

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

function setup(clearOnPick?: boolean) {
  const host = document.createElement("div");
  const input = document.createElement("input");
  const results = document.createElement("div");
  host.append(input, results);
  document.body.append(host);
  const cards: SearchCard[] = [
    { n: "Sol Ring", t: "Artifact" },
    { n: "Solemn Simulacrum", t: "Artifact Creature — Golem" },
  ];
  const onPick = vi.fn();
  wireCardSearch({
    input,
    results,
    source: {
      loaded: () => true,
      ready: async () => {},
      search: (q) => cards.filter((c) => c.n.toLowerCase().includes(q.toLowerCase())),
      find: (name) => cards.find((c) => c.n === name),
    },
    onPick,
    rowAttr: "data-ps-card",
    clearOnPick,
  });
  return { input, results, onPick };
}

async function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(100);
}

it("lists matches above the box, best match last, and Enter picks it", async () => {
  vi.useFakeTimers();
  const { input, results, onPick } = setup(false);
  expect(results.nextElementSibling).toBe(input);
  await type(input, "sol");
  const rows = [...results.querySelectorAll(".pm-sr-row")];
  expect(rows.map((r) => r.getAttribute("data-ps-card"))).toEqual([
    "Solemn Simulacrum",
    "Sol Ring",
  ]);
  expect(rows[1].classList.contains("pm-sr-best")).toBe(true);
  expect(rows[1].querySelector("mark")?.textContent).toBe("Sol");
  expect(rows[0].querySelector("small")?.textContent).toBe("Artifact Creature");
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  expect(onPick).toHaveBeenCalledWith({ n: "Sol Ring", t: "Artifact" });
  expect(input.value).toBe("sol");
});

it("shows a note for no match, and still renders after the caller clears the list", async () => {
  vi.useFakeTimers();
  const { input, results } = setup();
  await type(input, "zz");
  expect(results.textContent).toContain("No card found");
  results.replaceChildren();
  await type(input, "ring");
  expect(results.querySelectorAll(".pm-sr-row")).toHaveLength(1);
});
