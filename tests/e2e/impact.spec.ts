import { readFileSync } from "node:fs";
import { test, expect } from "./offline";

async function chart(page: import("@playwright/test").Page): Promise<void> {
  const samples = JSON.parse(
    readFileSync(new URL("../../public/data/TRY_A_DECK_OPTIONS.json", import.meta.url), "utf8"),
  ) as { key: string; decklist: string; commander: string }[];
  const sample = samples.find((d) => d.key === "uril")!;
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await page.locator("#decklistInput").fill(`${sample.decklist}\n1 Lotus Petal`);
  await page.locator("#commanderInput").fill(sample.commander);
  await page.getByRole("button", { name: "Chart Deck", exact: true }).click();
  await expect(page.locator("#status")).toContainText(/^Charted /);
}

test("Impact opens read-only, expands ideas and preserves the standard chart on reopen", async ({
  page,
}) => {
  await chart(page);
  const scores = page.locator("#chartArea .chart-scores, #chartArea .command-spark .num");
  const standard = await scores.allTextContents();
  const radar = await page.locator("#chartArea svg").first().innerHTML();
  await page.locator("#impactCardsBtn").click();
  const dialog = page.getByRole("dialog", { name: "Impact cards", exact: true });
  await expect(dialog).toContainText("Sign in and join a pod");
  await expect(dialog.locator('input[type="checkbox"]').first()).toBeDisabled();
  await expect(dialog.locator(".impact-in-deck").first()).toBeVisible();
  await test
    .info()
    .attach("impact-list", { body: await dialog.screenshot(), contentType: "image/png" });
  await dialog.locator("[data-impact-more]").click();
  await expect(dialog.locator(".impact-idea-row")).toHaveCount(24);
  await test
    .info()
    .attach("impact-ideas", { body: await dialog.screenshot(), contentType: "image/png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#impactCardsBtn")).toBeFocused();
  expect(await scores.allTextContents()).toEqual(standard);
  expect(await page.locator("#chartArea svg").first().innerHTML()).toBe(radar);
  await page.locator("#impactCardsBtn").click();
  await expect(dialog.locator(".impact-idea-row")).toHaveCount(24);
  await dialog.getByRole("button", { name: "Close ×", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("dismissing Impact during its deferred data load never reopens the dialog", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route("**/data/IMPACT_CANDS.json*", async (route) => {
    requested = true;
    await pending;
    await route.continue();
  });
  try {
    await chart(page);
    await page.locator("#impactCardsBtn").click();
    await expect.poll(() => requested).toBe(true);
    await expect(page.locator("#impactBody")).toHaveText("Loading\u2026");
    await page.keyboard.press("Escape");
    release();
    await expect(page.locator("#tadOverlay")).toHaveCount(0);
    await page.locator("#impactCardsBtn").click();
    await expect(page.locator("#impactBody")).toContainText("Sign in and join a pod");
  } finally {
    release();
  }
});
