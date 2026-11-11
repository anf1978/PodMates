// The bot-published win-rates and Scryfall Tagger tags reach the engine and Synergy through
// src/services/card-data.ts. Runs on the Vite dev server ("modules" project) to read them.
import { test, expect } from "./offline";
import { withModules } from "./modules";

test("DB-ready loads the win-rate and tag datasets into the page's card data", async ({ page }) => {
  const winratesResponse = page.waitForResponse("**/data/winrates.json*");
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  const winrates = (await (await winratesResponse).json()) as { n: string; t: string }[];
  const loaded = await withModules<{ first: unknown; blink: number; extraCombat: number }>(
    page,
    { data: "/src/services/card-data.ts" },
    `const name = ${JSON.stringify(winrates[0].n)};
    const tags = data.interactionTags();
    return {
      first: data.pageContext().winRates.find((r) => r.n === name),
      blink: tags.blink.size,
      extraCombat: tags.extraCombat.size,
    };`,
  );
  expect(loaded.first).toEqual(winrates[0]);
  expect(loaded.blink).toBeGreaterThanOrEqual(50);
  expect(loaded.extraCombat).toBeGreaterThanOrEqual(10);
});
