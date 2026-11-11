import { test, expect } from "./offline";

test("the sample entry point cancels a closed loading dialog and hands off six decks without a real battle", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/data/TRY_A_DECK_OPTIONS.json*", async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  // MyPods' existing signed-out screen has no sample button. Exercise its legacy entry point
  // without signing in or running the unmoved comparison SVG renderer (height="auto").
  await page.evaluate(`renderPodAnalysisResults = decks => { document.body.dataset.sampleDecks = String(decks.length); };
    void runSampleGathering();`);
  await expect(page.getByRole("heading", { name: "Sample table", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  release();
  await expect(page.locator("#tadOverlay")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveAttribute("data-sample-decks");
  await page.evaluate("runSampleGathering()");
  await expect(page.locator("body")).toHaveAttribute("data-sample-decks", "6");
  expect(await page.evaluate("currentBattleContext")).toBeNull();
  await expect(page.locator("#battleControlsArea")).toBeEmpty();
  await expect(page.getByRole("button", { name: "Log Battle", exact: true })).toHaveCount(0);
});
