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

test("battle feedback keeps ratings independent and can be skipped without cloud writes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  // Host/non-host result callers share this remaining legacy entry point.
  await page.evaluate("showFeedbackSurvey('fixture-pod', 'fixture-battle')");
  await expect(page.getByRole("dialog")).toHaveAccessibleName("How was the battle?");
  await page.locator("#funRatingRow [data-rate='4']").click();
  await page.locator("#bestMomentInput").fill("One life left!");
  await page.locator("#accuracyRatingRow [data-rate='5']").click();
  await expect(page.locator("#funRatingRow .chronicles-rating-selected")).toHaveText("4");
  await expect(page.locator("#accuracyRatingRow .chronicles-rating-selected")).toHaveText("5");
  await expect(page.locator("#bestMomentInput")).toHaveValue("One life left!");
  await test.info().attach("feedback", {
    body: await page.getByRole("dialog").screenshot(),
    contentType: "image/png",
  });
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
