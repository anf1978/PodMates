// Offline comparison entry point, including its real renderer and deck-detail dialog.
import { test, expect } from "./offline";

test("sample table renders all comparison panels and opens a ranked deck", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    Math.random = () => 0.31;
  });
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await page.evaluate("runSampleGathering()");
  const results = page.locator("#podResultsSection");
  await expect(results).toBeVisible();
  await expect(page.locator("#podRankArea tbody tr")).toHaveCount(6);
  await page.locator("#podResultsSection details").evaluateAll((nodes) => {
    nodes.forEach((node) => ((node as HTMLDetailsElement).open = true));
  });
  await expect(page.locator("#podChartsArea svg")).toHaveCount(6);
  await expect(page.locator("#paceRadarArea circle")).toHaveCount(6);
  await expect(page.locator("#podSummaryBanner")).toContainText("Rule Zero Overview");
  await results.screenshot({ path: info.outputPath("comparison.png") });
  await page.locator("[data-pod-deck-index]").first().click();
  await expect(page.locator("#tadOverlay")).toContainText("Commander Track Record");
  await page.locator("#tadOverlay .tad-modal").screenshot({ path: info.outputPath("detail.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator("#tadOverlay")).toHaveCount(0);
  await page.getByRole("button", { name: "Deck Chart", exact: true }).click();
  await expect(results).toBeHidden();
  await page.locator("#modePodBtn").click();
  await expect(results).toBeVisible();
});
