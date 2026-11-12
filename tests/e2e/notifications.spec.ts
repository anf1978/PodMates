import { test, expect } from "./offline";

test("notification shell preserves settings and the shared dialog lifecycle", async ({ page }) => {
  await page.goto("/");
  const bell = page.locator("#pmBellBtn");
  await expect(bell).toBeAttached();
  await expect(bell).toBeHidden();
  // Open the real inbox offline; signed-in feed/routing coverage uses repository mocks in unit tests.
  await bell.evaluate((button: HTMLButtonElement) => button.click());
  const dialog = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(dialog).toContainText("Nothing new yet.");
  await page.getByText("What to tell me about", { exact: true }).click();
  const deckPreference = page.getByLabel("A podmate charts a new deck", { exact: true });
  await expect(deckPreference).toBeChecked();
  await deckPreference.uncheck();
  await expect(dialog.locator("details")).toHaveAttribute("open", "");
  await expect(deckPreference).not.toBeChecked();
  await test.info().attach("notifications-empty-settings", {
    body: await dialog.screenshot(),
    contentType: "image/png",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#decklistInput")).toHaveValue("");
});
