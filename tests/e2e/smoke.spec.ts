import type { Page } from "@playwright/test";
import { test, expect } from "./offline";

async function expectAnalysis(page: Page) {
  await expect(page.getByRole("heading", { name: /Deck Profile$/ })).toBeVisible();
  const chart = page.locator("#chartArea");
  await expect(chart.locator("svg")).toBeVisible();
  await expect(chart.locator("svg polygon.deck-shape")).toBeVisible();
  await expect(chart.locator("svg .deck-point")).toHaveCount(5);
  await expect(chart.locator("svg .axis-label")).toHaveText([
    /Speed/,
    /Consistency/,
    /Versatility/,
    /Disruption/,
    /Power Level/,
  ]);

  for (const [heading, content] of [
    ["Key Pieces & Combos", "#keyPiecesArea"],
    ["Mana Curve", "#manaCurveArea"],
    ["Win Condition & Table Vibe", "#winConCallout"],
    ["Official Bracket Signals", "#bracketArea"],
    ["Card Type Frequency & Curve", "#typeTableArea"],
    ["Mana Base: Cost vs. Production", "#manaBaseArea"],
    ["Synergy Profile", "#synergyArea"],
    ["Commander Centrality", "#centralityArea"],
    ["Structure & Legality", "#legalityArea"],
  ]) {
    const summary = page.locator("summary").filter({ hasText: heading });
    await expect(summary).toBeVisible();
    const details = summary.locator("..");
    if ((await details.getAttribute("open")) === null) await summary.click();
    await expect(page.locator(content)).toBeVisible();
    await expect(page.locator(content)).not.toBeEmpty();
  }
}

test("card DB loads, a sample deck charts, and a pasted decklist analyses", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  const chartButton = page.getByRole("button", { name: "Chart Deck", exact: true });
  await expect(chartButton).toBeEnabled();

  await page.getByRole("button", { name: "Try a Deck", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Try a Deck", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Browse by Archetype/ }).click();
  await page.getByRole("button", { name: /^Voltron\b/ }).click();
  await page.getByRole("button", { name: /Commander:.*Uril, the Miststalker/ }).click();
  await expect(page.locator("#decklistInput")).not.toHaveValue("");
  await chartButton.click();
  await expect(page.locator("#status")).toContainText(/^Charted \d+ cards/);
  await expectAnalysis(page);

  await page.locator("#commanderInput").fill("");
  await page
    .locator("#decklistInput")
    .fill(
      [
        "Commander:",
        "1 Atraxa, Praetors' Voice",
        "Deck:",
        "1 Sol Ring",
        "1 Arcane Signet",
        "1 Swords to Plowshares",
        "1 Command Tower",
        "4 Forest",
      ].join("\n"),
    );
  await chartButton.click();
  await expect(page.locator("#status")).toContainText("Charted 9 cards (6 unique)");
  await expect(page.locator("#status")).toContainText("Commander: Atraxa, Praetors' Voice");
  await expect(page.locator("#notFoundBox")).toBeEmpty();
  await expectAnalysis(page);
});

test("DB-ready and an early Try-a-Deck click wait for extracted datasets", async ({ page }) => {
  let releaseDataset!: () => void;
  const pendingDataset = new Promise<void>((resolve) => {
    releaseDataset = resolve;
  });
  await page.route("**/data/TRY_A_DECK_OPTIONS.json", async (route) => {
    await pendingDataset;
    await route.continue();
  });
  try {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Chart Deck", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Try a Deck", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Try a Deck", exact: true })).toBeHidden();
    releaseDataset();
    await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
    await expect(page.getByRole("heading", { name: "Try a Deck", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Browse by Archetype/ }).click();
    await expect(page.getByRole("button", { name: /^Voltron\b/ })).toBeVisible();
  } finally {
    releaseDataset();
  }
});
