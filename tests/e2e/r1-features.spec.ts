import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { test, expect } from "./offline";

async function screenshot(page: Page, info: TestInfo, name: string) {
  const dir = process.env.PM_R1_SCREENSHOTS;
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${name}.png`);
  await page.mouse.move(0, 0);
  await page.locator("#tadOverlay .tad-modal").screenshot({ path, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}

test("Try-a-Deck navigates releases, styles and blends and loads a deck", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await page.locator("#sampleBtn").click();
  await expect(page.getByRole("button", { name: /Browse by Archetype/ })).toBeVisible();
  await screenshot(page, info, "try-home");
  await page.getByRole("button", { name: /Browse Precon Releases/ }).click();
  await page.locator('[data-tad-action="goto-year"]').first().click();
  await page.locator('[data-tad-action="goto-set"]').first().click();
  await expect(page.locator(".tad-option").first()).toBeVisible();
  for (let i = 0; i < 3; i++) await page.locator("#tadBackBtn").click();
  await page.getByRole("button", { name: /Browse by Exact Style/ }).click();
  await page.locator('[data-tad-action="goto-style"]').first().click();
  await expect(page.locator(".tad-option").first()).toBeVisible();
  for (let i = 0; i < 2; i++) await page.locator("#tadBackBtn").click();
  await page.getByRole("button", { name: /Browse by Archetype/ }).click();
  await screenshot(page, info, "try-archetypes");
  await page.getByRole("button", { name: /^Voltron\b/ }).click();
  await screenshot(page, info, "try-decks");
  await page.getByRole("button", { name: /Commander:.*Uril, the Miststalker/ }).click();
  await expect(page.locator("#tadOverlay")).toHaveCount(0);
  await expect(page.locator("#commanderInput")).toHaveValue("Uril, the Miststalker");
  await expect(page.locator("#chartBtn")).toHaveClass(/tad-pulsing/);
});

test("export copies commander sections and full double-faced card names", async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await page
    .locator("#decklistInput")
    .fill(
      "Commander\n1 Atraxa, Praetors' Voice\nDeck\n1 Sol Ring\n1 Delver of Secrets // Insectile Aberration\n4 Forest",
    );
  await page.locator("#chartBtn").click();
  await expect(page.locator("#status")).toContainText("Charted");
  await page.locator("#exportDeckBtn").click();
  const text = await page.locator("#tadOverlay textarea").inputValue();
  expect(text).toContain("Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n");
  expect(text.match(/Atraxa, Praetors' Voice/g)).toHaveLength(1);
  expect(text).toContain("1 Delver of Secrets // Insectile Aberration");
  await screenshot(page, info, "export");
  await page.locator("#exportCopyBtn").click();
  await expect(page.locator("#exportCopyStatus")).toHaveText("Copied.");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.replace(/\r\n/g, "\n")).toBe(text);
});

test("scan accumulates matches, respects selection and rescans the same photo", async ({
  page,
}, info) => {
  await page.route("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.Tesseract = { recognize: async () => ({ data: { text: "Sol Ring Arcane Signet" } }) };`,
    }),
  );
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await page.locator("#openDeckBuilderBtn").click();
  await page.locator("#dbScanBtn").click();
  await expect(page.getByRole("heading", { name: "Scan Cards from Photo" })).toBeVisible();
  await screenshot(page, info, "scan");
  await page.locator("#scanCardsFileInput").setInputFiles({
    name: "cards.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator("#scanCardsStatus")).toContainText("found 2 new card(s)");
  await page.locator("#scanCardsRescanBtn").click();
  await expect(page.locator("#scanCardsStatus")).toContainText("found 2 new card(s)");
  await expect(page.locator("[data-scan-result-index]")).toHaveCount(2);
  await page.locator("[data-scan-result-index]").first().uncheck();
  await screenshot(page, info, "scan-results");
  await page.locator("#scanCardsAddToDeckBtn").click();
  await expect(page.locator("#dbDeckList")).toContainText("Sol Ring");
  await expect(page.locator("#dbDeckList")).not.toContainText("Arcane Signet");
  await page.locator("#dbScanBtn").click();
  await expect(page.locator("#scanCardsRescanBtn")).toBeEnabled();
  await page.locator("#scanCardsRescanBtn").click();
  await expect(page.locator("#scanCardsStatus")).toContainText("found 1 new card(s)");
  await page.keyboard.press("Escape");
  await expect(page.locator("#dbDeckList")).toBeVisible();
});
