import { gzipSync } from "node:zlib";
import { test, expect } from "./offline";
import { openPriceScry } from "./pricescry-fixture";

test("PriceScry mounts the signed-out Spoiler Bait gate and restores it on reopen", async ({
  page,
}) => {
  await page.route(
    "https://raw.githubusercontent.com/anf1978/PodMates/pricescry-data/**",
    (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("signals.json.gz"))
        return route.fulfill({ contentType: "application/octet-stream", body: gzipSync("[]") });
      return route.fulfill({ json: { day: "2026-11-11", cards: [], pairs: [] } });
    },
  );
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await openPriceScry(page);
  await page.locator('[data-ps-tab="bait"]').click();
  await expect(page.locator("#sbHost")).toHaveText(
    "Sign in to your PodMates account to use Spoiler Bait, so your likes are saved.",
  );
  await expect(page.locator("#sbTop")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#pricescryOverlay")).toHaveCount(0);
  await openPriceScry(page);
  await page.locator('[data-ps-tab="bait"]').click();
  await expect(page.locator("#sbHost")).toContainText("Sign in to your PodMates account");
});
