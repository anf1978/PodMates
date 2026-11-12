// PriceScry's lazy screen against local price data: password gate, search → card → back, and every data tab.
import { test, expect } from "./offline";
import { openPriceScry, routePriceData } from "./pricescry-fixture";

test.beforeEach(async ({ page }) => {
  await routePriceData(page);
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
});

test("asks for the password once per session and refuses a wrong one", async ({ page }) => {
  await page.locator("#authProfileBtn").evaluate((button: HTMLButtonElement) => button.click());
  await page.locator("#profilePriceScryBtn").click();
  await page.locator("#psPwInput").fill("not the word");
  await page.locator("#psPwInput").press("Enter");
  await expect(page.locator("#psPwStatus")).toHaveText("That isn't the password.");
  await expect(page.locator("#pricescryOverlay")).toHaveCount(0);
});

test("finds a card, charts it and returns to the same list", async ({ page }) => {
  await openPriceScry(page);
  const screen = page.getByRole("dialog", { name: "PriceScry" });
  await expect(page.locator("#psAsOf")).toHaveText(
    "Prices as of 2026-11-10 · history since 2026-08-01 · 1,234 cards",
  );
  await screen.locator("#psSearch").fill("Sol Rin");
  await screen.locator('[data-ps-card="Sol Ring"]').first().click();
  await expect(screen.locator(".ps-card-title")).toHaveText("Sol Ring");
  await expect(screen.locator(".ps-badge")).toHaveText(["Game Changer"]);
  await screen.locator("#psPrinting").selectOption("0000579f-7b35-4ed3-b44c-db2a538066fe");
  await expect(screen.locator(".ps-legend span")).toHaveCount(6);
  await expect(screen.locator(".ps-stat b").first()).toHaveText("¥270");
  await screen.locator("#psChartSvg").scrollIntoViewIfNeeded();
  const chart = (await screen.locator("#psChartSvg").boundingBox())!;
  await page.mouse.move(chart.x + chart.width - 5, chart.y + chart.height / 2);
  await expect(screen.locator("#psReadout")).toContainText("2026-11-10 · US market ¥270");
  await screen.locator("#psPlan > summary").click();
  await expect(screen.locator("#psPlOut")).toContainText(
    "Caution: this card got a new printing in the last 90 days (Test Set).",
  );
  await screen.locator("#psRealBuy").click();
  await expect(page.getByText("Sign in to keep a trade ledger.")).toBeVisible();
  await screen.locator("#psBack").click();
  await expect(screen.locator("#psSearch")).toHaveValue("Sol Rin");
});

test("renders Movers, Signals and Radar and opens cards from them", async ({ page }) => {
  await openPriceScry(page);
  const screen = page.getByRole("dialog", { name: "PriceScry" });
  await screen.getByRole("button", { name: "Movers", exact: true }).click();
  await expect(screen.locator(".ps-mover")).toHaveText([/Sol Ring3 of 4 shops agree¥270\+12\.5%/]);
  await screen.locator('[data-ps-md="down"]').click();
  await expect(screen.locator(".ps-mover")).toHaveText([/Arcane Signet/]);
  await screen.getByRole("button", { name: "Signals", exact: true }).click();
  await expect(screen.locator(".ps-signal")).toHaveCount(5);
  await expect(screen.locator(".ps-board-h").nth(1)).toContainText("Prediction scoreboard");
  await screen.locator('[data-ps-sig="bans"]').click();
  await expect(screen.locator(".ps-signal")).toHaveText([
    "Commander: Mana Crypt went from legal to banned",
  ]);
  await screen.getByRole("button", { name: "Radar", exact: true }).click();
  await expect(screen.locator(".ps-radar-post a")).toHaveText("Spoiler <talk>");
  await screen.locator(".ps-radar-found .ps-link", { hasText: "Sol Ring" }).click();
  await expect(screen.locator(".ps-card-title")).toHaveText("Sol Ring");
  await expect(screen.locator('[data-ps-tab="radar"]')).toHaveClass("on");
  await screen.locator("#psBack").click();
  await expect(screen.locator(".ps-radar-set")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(screen).toHaveCount(0);
});
