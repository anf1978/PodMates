import { test, expect } from "./offline";

test("account forms preserve email across modes, validation and password reset", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Create an Account");
  await test.info().attach("signup", { body: await dialog.screenshot(), contentType: "image/png" });
  await page.getByLabel("Email", { exact: true }).fill("player@example.test");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(dialog).toContainText("Email and password are both required.");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("player@example.test");
  await page.getByRole("link", { name: "Log in", exact: true }).click();
  await expect(dialog).toHaveAccessibleName("Log In");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("player@example.test");
  await test.info().attach("login", { body: await dialog.screenshot(), contentType: "image/png" });
  await page.getByLabel("Email", { exact: true }).fill("");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(dialog).toContainText(
    'Enter your email above first, then click "Forgot password?" again.',
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeFocused();
});

test("profile opens its optional account form without changing the deck form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
  // Exercise the optional profile shell offline; real sign-in RPCs are tested at the repository boundary.
  await page.locator("#authProfileBtn").evaluate((button: HTMLButtonElement) => button.click());
  const dialog = page.getByRole("dialog", { name: "My Profile", exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator("#profileLinkedDecks")).toContainText("No decks saved yet");
  await test.info().attach("profile", {
    body: await dialog.screenshot(),
    contentType: "image/png",
  });
  await page.getByRole("button", { name: "Save Name" }).click();
  await expect(page.locator("#profileNameStatus")).toHaveText("Enter a name first.");
  await page.getByRole("button", { name: "Add Deck", exact: true }).click();
  await expect(page.locator("#profileSyncStatus")).toHaveText("Paste a deck link first.");
  await page.getByRole("button", { name: "Close ×", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#decklistInput")).toHaveValue("");
});
