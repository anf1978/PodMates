import { test, expect } from "./offline";

// Signed out (the offline fixture blocks Firebase RPCs): the saved-deck flows explain what they
// need instead of failing. Signed-in behaviour is covered by the unit tests with mocked repositories.
test("Save, Load a Deck and Build Table guide a signed-out visitor", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  const status = page.locator("#deckMgmtStatus");

  await page.locator("#saveDeckBtn").click();
  await expect(status).toHaveText("Paste a decklist before saving.");
  await page.locator("#decklistInput").fill("1 Sol Ring");
  await page.locator("#saveDeckBtn").click();
  await expect(status).toHaveText("Commander is required to save. Enter the commander name above.");
  await expect(page.locator("#commanderInput")).toBeFocused();
  await page.locator("#commanderInput").fill("Talrand, Sky Summoner");
  await page.locator("#playerInput").fill("Alex");
  await page.locator("#saveDeckBtn").click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Create an Account");
  await page.keyboard.press("Escape");

  await page.locator("#loadDeckBtn").click();
  await expect(status).toHaveText("No saved decks yet — save one first.");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.locator("#modePodBtn").click();
  await page.getByText("The Full Ledger", { exact: true }).click();
  await page.locator("#buildSavedDecksTableBtn").click();
  await expect(page.locator("#savedDecksTableStatus")).toHaveText(
    "No saved decks yet — save one from the main tab first.",
  );
  await expect(page.locator("#savedDecksTableArea")).toBeEmpty();
});
