// Runs on the Vite dev server (playwright.config.ts "modules" project): the sample table has no
// signed-out UI entry, so the test reaches the page's own modules by path.
import { test, expect } from "./offline";
import { BATTLE, EVENTS, withModules } from "./modules";

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
  // Count the handed-off decks instead of drawing them (comparison.modules.spec.ts draws them).
  await withModules(
    page,
    { battle: BATTLE, events: EVENTS },
    `battle.provideComparisonView({
      show(decks) { document.body.dataset.sampleDecks = String(decks.length); return { avgSpark: 0, spread: 0 }; },
      destroy() {},
    });
    events.emit("gatherings:sample", undefined);`,
  );
  await expect(page.getByRole("heading", { name: "Sample table", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  release();
  await expect(page.locator("#tadOverlay")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveAttribute("data-sample-decks");
  await withModules(page, { events: EVENTS }, `events.emit("gatherings:sample", undefined);`);
  await expect(page.locator("body")).toHaveAttribute("data-sample-decks", "6");
  expect(await withModules(page, { battle: BATTLE }, "return battle.battleContext();")).toBeNull();
  await expect(page.locator("#battleControlsArea")).toBeEmpty();
  await expect(page.getByRole("button", { name: "Log Battle", exact: true })).toHaveCount(0);
});

test("after a fresh load the sample table loads the deck library on demand", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(new URL(request.url()).pathname));
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await withModules(
    page,
    { battle: BATTLE, events: EVENTS },
    `battle.provideComparisonView({
      show(decks) { document.body.dataset.sampleDecks = String(decks.length); return { avgSpark: 0, spread: 0 }; },
      destroy() {},
    });
    events.emit("gatherings:sample", undefined);`,
  );
  await expect(page.locator("body")).toHaveAttribute("data-sample-decks", "6");
  expect(requested.filter((path) => path === "/data/TRY_A_DECK_OPTIONS.json")).toHaveLength(1);
});
