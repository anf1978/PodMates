import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./offline";

// A real first visit: no stored tips (the shared config switches them off for every other spec).
test.use({ storageState: { cookies: [], origins: [] } });

test("first visit: welcome card, then the first-chart tour through to the end", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  const tip = page.locator("#pmTutorial .tut-card");
  await expect(tip.getByRole("heading", { name: "Welcome to PodMates" })).toBeVisible();

  const results = await new AxeBuilder({ page }).include("#pmTutorial").analyze();
  expect(
    results.violations.filter(({ impact }) => impact === "serious" || impact === "critical"),
  ).toEqual([]);

  await tip.getByRole("button", { name: "Show me" }).click();
  await expect(tip.getByRole("heading", { name: "Pick a deck" })).toBeVisible();

  // Closing Try a Deck without choosing leaves the step waiting; nothing navigates away.
  await page.getByRole("button", { name: "Try a Deck", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Try a Deck", exact: true })).toBeVisible();
  await expect(page.locator("#pmTutorial")).toBeHidden();
  await page.getByRole("button", { name: /Browse by Archetype/ }).click();
  await page.getByRole("button", { name: /^Voltron\b/ }).click();
  await page.getByRole("button", { name: /Commander:.*Uril, the Miststalker/ }).click();

  await expect(tip.getByRole("heading", { name: "Chart it" })).toBeVisible();
  await page.getByRole("button", { name: "Chart Deck", exact: true }).click();
  await expect(tip.getByRole("heading", { name: "The deck's profile" })).toBeVisible();
  await expect(page.locator("#chartArea").locator("xpath=..")).toHaveClass(/tut-target/);

  while (await tip.getByRole("button", { name: "Next" }).isVisible()) {
    await tip.getByRole("button", { name: "Next" }).click();
  }
  await expect(tip.getByRole("heading", { name: "That's the tour" })).toBeVisible();
  await tip.getByRole("button", { name: "Done" }).click();
  await expect(tip).toHaveCount(0);

  await page.reload();
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await expect(page.locator("#pmTutorial .tut-card")).toHaveCount(0);
});

test("Later, then replay from Help and tips", async ({ page }) => {
  await page.goto("/");
  const tip = page.locator("#pmTutorial .tut-card");
  await tip.getByRole("button", { name: "Later" }).click();
  await expect(tip).toHaveCount(0);
  await page.getByRole("button", { name: "Help and tips" }).click();
  await page.getByRole("button", { name: "Take the tour" }).click();
  await expect(tip.getByRole("heading", { name: "Pick a deck" })).toBeVisible();
});

test("a first-use tip appears once, the first time its field is used", async ({ page }) => {
  await page.goto("/");
  const tip = page.locator("#pmTutorial .tut-card");
  await tip.getByRole("button", { name: "No thanks" }).click();
  await page.locator("#decklistInput").focus();
  await expect(tip.getByRole("heading", { name: "Paste a decklist" })).toBeVisible();
  await tip.getByRole("button", { name: "Got it" }).click();
  await expect(tip).toHaveCount(0);
  await page.locator("#chartBtn").focus();
  await page.locator("#decklistInput").focus();
  await expect(tip).toHaveCount(0);
});
