import { test, expect } from "./offline";

type Root = { theme: string | null; text: string | null; bg: string; zoom: string };
declare global {
  interface Window {
    __pmRootAtBody?: Root;
  }
}

test("display settings apply a theme and text size that survive a reload before first paint", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-pm-theme", "classic");
  await page.locator("#authProfileBtn").evaluate((button: HTMLButtonElement) => button.click());
  const dialog = page.getByRole("dialog", { name: "My Profile", exact: true });
  await expect(dialog).toBeVisible();
  await page.locator("#profileDisplayDetails > summary").click();
  const tray = page.locator("#profileDisplayArea");
  await expect(tray.locator(".pm-theme-tile")).toHaveCount(27);
  await expect(tray.locator('[data-theme-id="classic"]')).toHaveAttribute("aria-checked", "true");

  await tray.getByRole("radio", { name: /Izzet/ }).click();
  await expect(tray.locator('[data-theme-id="izzet"]')).toHaveAttribute("aria-checked", "true");
  await expect(tray.locator("b")).toHaveText("Izzet");
  await expect(page.locator("#podmatesToast")).toHaveText("Izzet colours applied.");
  await tray.getByRole("radio", { name: /Larger/ }).click();
  await expect(page.locator("#podmatesToast")).toHaveText("Text size: Larger.");
  await test.info().attach("display-settings", {
    body: await tray.screenshot(),
    contentType: "image/png",
  });
  const applied = await page.evaluate(() => ({
    bg: document.documentElement.style.getPropertyValue("--bg-main"),
    meta: document.querySelector('meta[name="theme-color"]')!.getAttribute("content"),
  }));
  expect(applied.bg).toMatch(/^#[0-9A-F]{6}$/);
  expect(applied.meta).toBe(applied.bg);

  // The inline pre-paint script must already have applied both choices when <body> starts.
  await page.addInitScript(() => {
    new MutationObserver((_records, observer) => {
      if (!document.body) return;
      observer.disconnect();
      const root = document.documentElement;
      window.__pmRootAtBody = {
        theme: root.getAttribute("data-pm-theme"),
        text: root.getAttribute("data-pm-text"),
        bg: root.style.getPropertyValue("--bg-main"),
        zoom: root.style.zoom,
      };
    }).observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  expect(await page.evaluate(() => window.__pmRootAtBody)).toEqual({
    theme: "izzet",
    text: "1.3",
    bg: applied.bg,
    zoom: "1.3",
  });
});
