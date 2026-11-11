import type { Page } from "@playwright/test";
import { test, expect } from "./offline";

declare global {
  interface Window {
    showInfoModal(headerHtml: string, bodyHtml: string): void;
    showActionConfirmModal(
      message: string,
      confirmLabel: string,
      onConfirm: () => void,
      onCancel?: () => void,
    ): void;
    showSingleCardArtModal(name: string): Promise<void>;
    openPriceScry(): void;
    __cancelled?: boolean;
  }
}

async function chartSample(page: Page) {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  await page.getByRole("button", { name: "Try a Deck", exact: true }).click();
  await page.getByRole("button", { name: /Browse by Archetype/ }).click();
  await page.getByRole("button", { name: /^Voltron\b/ }).click();
  await page.getByRole("button", { name: /Commander:.*Uril, the Miststalker/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Chart Deck", exact: true }).click();
  await expect(page.locator("#status")).toContainText(/^Charted \d+ cards/);
}

const bodyOverflow = (page: Page) => page.evaluate(() => document.body.style.overflow);

test("a dialog traps focus, locks scroll, and closes on Escape, backdrop and Close", async ({
  page,
}) => {
  await chartSample(page);
  const opener = page.locator("#resultsSection button.info-btn:visible").first();
  await opener.focus();
  await opener.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toBeFocused();
  expect(await bodyOverflow(page)).toBe("hidden");

  // Tab cycles inside the dialog and never reaches the page behind it.
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await bodyOverflow(page)).toBe("");

  await opener.click();
  await expect(dialog).toHaveCount(1);
  await page.locator("#tadOverlay").click({ position: { x: 5, y: 5 } });
  await expect(dialog).toHaveCount(0);

  await opener.click();
  await dialog.getByRole("button", { name: /Close/ }).click();
  await expect(dialog).toHaveCount(0);
  expect(await bodyOverflow(page)).toBe("");
});

test("Try a Deck closes on Escape and returns focus to its button", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  const opener = page.getByRole("button", { name: "Try a Deck", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Try a Deck", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await bodyOverflow(page)).toBe("");
});

test("Escape closes only the top stacked layer, and cancels an action confirm", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);

  await page.evaluate(() => window.showInfoModal("<h2>Base</h2>", "<p>Under</p>"));
  await page.evaluate(() => void window.showSingleCardArtModal("Sol Ring"));
  await expect(page.locator("#tadArtOverlay")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(2);

  await page.keyboard.press("Escape");
  await expect(page.locator("#tadArtOverlay")).toHaveCount(0);
  await expect(page.locator("#tadOverlay")).toBeVisible();
  expect(await bodyOverflow(page)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await bodyOverflow(page)).toBe("");

  await page.evaluate(() =>
    window.showActionConfirmModal(
      "Leave?",
      "Leave",
      () => {},
      () => {
        window.__cancelled = true;
      },
    ),
  );
  await expect(page.getByRole("dialog")).toContainText("Leave?");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => window.__cancelled)).toBe(true);
});

test("the full-screen PriceScry overlay locks scroll and closes on Escape", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  // A tiny local price index, so the screen renders without contacting GitHub.
  await page.route(
    "https://raw.githubusercontent.com/anf1978/PodMates/pricescry-data/**",
    (route) =>
      route.fulfill({
        json: route.request().url().endsWith("/index.json")
          ? { day: "2025-01-02", firstDay: "2025-01-01", cards: 1 }
          : {},
      }),
  );
  await page.evaluate(() => window.openPriceScry());
  const screen = page.getByRole("dialog", { name: "PriceScry" });
  await expect(screen).toBeVisible();
  await expect(page.locator("#psAsOf")).toContainText("Prices as of 2025-01-02");
  expect(await bodyOverflow(page)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(screen).toHaveCount(0);
  expect(await bodyOverflow(page)).toBe("");
});
