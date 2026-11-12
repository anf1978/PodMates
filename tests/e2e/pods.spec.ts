import { test, expect } from "./offline";

test("MyPods keeps the signed-out sign-in entry and returns to the landing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  await page.getByRole("button", { name: "MyPods", exact: true }).click();
  await expect(page.locator("#ourPodPanelArea")).toContainText(
    "Sign up or log in to create or join a pod",
  );
  const opener = page.locator("#ourPodSignUpBtn");
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#authSubmitBtn")).toHaveText("Create Account");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.locator("#podMode")).toBeVisible();
});
