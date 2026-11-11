import { test, expect } from "./offline";

test("pod chronicles stay readable as a guest and clearing opens optional sign-in", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#modePodBtn").click();
  await page.getByText("Chronicles & Stories", { exact: true }).click();
  await expect(page.locator("#matchLogArea")).toContainText("No chapters yet");
  await page.locator("#clearMatchHistoryBtn").click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Create an Account");
  await page.keyboard.press("Escape");
  await expect(page.locator("#clearMatchHistoryBtn")).toBeFocused();
});
