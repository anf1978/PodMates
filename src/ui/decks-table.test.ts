// @vitest-environment happy-dom
import { beforeEach, expect, it } from "vitest";
import { clearDecksTable, showDecksTable } from "./decks-table";

const row = (commander: string, player: string, commandSpark: number, speed: number) => ({
  key: commander,
  commander,
  player,
  speed,
  consistency: 5,
  versatility: 5,
  disruption: 5,
  powerLevel: 5,
  commandSpark,
  pctPrecon: 50,
  pctTuned: null,
  pctCedh: 3,
  bracket: "3",
});

let area: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = "<div id='t'>old <b>markup</b></div>";
  area = document.getElementById("t")!;
});

const commanders = () =>
  [...area.querySelectorAll("tbody tr td:first-child")].map((td) => td.textContent);
const chain = () =>
  area.querySelector(".decks-table-chain")!.textContent!.replace(/\s+/g, " ").trim();
const header = (label: string) =>
  [...area.querySelectorAll<HTMLElement>("th")].find((th) =>
    th.textContent!.trim().startsWith(label),
  )!;

it("starts sorted by Spark, highest first, and formats each column", () => {
  showDecksTable(area, [row("A", "Ann", 4, 9), row("B", "Bo", 7.25, 1)], "a reference summary");
  expect(area.textContent).not.toContain("old markup");
  expect(commanders()).toEqual(["B", "A"]);
  expect(chain()).toMatch(/^Sorted by: Spark ▼/);
  const cells = [...area.querySelectorAll("tbody tr:first-child td")].map((td) => td.textContent);
  expect(cells).toEqual([
    "B",
    "Bo",
    "1.0",
    "5.0",
    "5.0",
    "5.0",
    "5.0",
    "7.3",
    "50%",
    "–",
    "3%",
    "3",
  ]);
  expect(area.querySelector(".decks-table-note")!.textContent).toContain("(a reference summary)");
});

it("sorts like a spreadsheet chain and clears back to the default", () => {
  showDecksTable(area, [row("C", "Zed", 1, 2), row("A", "Ann", 3, 2), row("B", "Ann", 2, 2)], "s");
  header("Player").click(); // replaces the default sort
  expect(chain()).toMatch(/^Sorted by: Player ▲/);
  expect(commanders()).toEqual(["A", "B", "C"]);
  header("Commander").click(); // added as the next level
  expect(commanders()).toEqual(["A", "B", "C"]);
  expect(header("Commander").querySelector("sup")!.textContent).toBe(" 2");
  header("Player").click(); // flips
  expect(commanders()).toEqual(["C", "A", "B"]);
  expect(chain()).toMatch(/^Sorted by: Player ▼ → Commander ▲/);
  area.querySelector<HTMLButtonElement>(".decks-table-clear")!.click();
  expect(chain()).toMatch(/^Sorted by: Spark ▼ Clear/);
  expect(commanders()).toEqual(["A", "B", "C"]);
});

it("clears the area for an empty list", () => {
  showDecksTable(area, [row("A", "Ann", 1, 1)], "s");
  clearDecksTable(area);
  expect(area.textContent!.trim()).toBe("");
});
