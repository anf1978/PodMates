// Real PriceScry tab wiring without contacting price APIs or a signed-in Firebase account.
import { test, expect } from "./offline";
test("Ledger renders its sign-in boundary and survives leaving and reopening the tab", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await page.evaluate(`pricescryCache.set('index.json', {day:'2026-11-11',firstDay:'2026-10-01',cards:100});
    pricescryCache.set('fx.json', {pairs:{}});
    openPriceScry();`);
  const overlay = page.locator("#pricescryOverlay");
  await expect(overlay.locator("#psSearch")).toBeVisible();
  await overlay.getByRole("button", { name: "Ledger", exact: true }).click();
  await expect(overlay.locator("#psBody")).toHaveText(
    "Sign in to keep a trade ledger. It is saved to your account, so it follows you between devices.",
  );
  await overlay.screenshot({ path: info.outputPath("ledger.png") });
  await overlay.getByRole("button", { name: "Search", exact: true }).click();
  await expect(overlay.locator("#psSearch")).toBeVisible();
  await overlay.getByRole("button", { name: "Ledger", exact: true }).click();
  await expect(overlay.locator("#psBody")).toContainText("Sign in to keep a trade ledger.");
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
});
