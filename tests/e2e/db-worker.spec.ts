import type { Page } from "@playwright/test";
import { test, expect } from "./offline";

// View Deck shows each matched card by its full name (image alt text), so a list resolves only
// through the lookup indexes the card DB built.
async function expectViewDeck(page: Page, decklist: string, cards: string[]) {
  await page.locator("#decklistInput").fill(decklist);
  await page.getByRole("button", { name: "View Deck", exact: true }).click();
  const gallery = page.getByRole("dialog");
  for (const name of cards)
    await expect(gallery.getByAltText(name, { exact: true })).toHaveCount(1);
}

for (const mode of ["worker", "main-thread fallback"] as const) {
  test(`card DB uses ${mode} and preserves lookup identity`, async ({ page }) => {
    const workers: string[] = [];
    let cardRequests = 0;
    page.on("worker", (worker) => workers.push(worker.url()));
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.endsWith("/data/cards.json")) cardRequests++;
    });
    if (mode === "main-thread fallback") {
      await page.addInitScript(() => Object.defineProperty(window, "Worker", { value: undefined }));
    }

    await page.goto("/");
    await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
    await expect(page.getByRole("button", { name: "Chart Deck", exact: true })).toBeEnabled();
    expect(workers).toHaveLength(mode === "worker" ? 1 : 0);
    expect(cardRequests).toBe(1);
    // Split cards resolve by full, front-face and back-face name.
    await expectViewDeck(page, "1 Fire // Ice\n1 Commit\n1 Petty Theft\n1 Sol Ring", [
      "Fire // Ice",
      "Commit // Memory",
      "Brazen Borrower // Petty Theft",
      "Sol Ring",
    ]);
  });
}

test("an invalid optional Spellbook snapshot keeps card analysis available", async ({ page }) => {
  await page.route("**/data/SPELLBOOK_SNAPSHOT_B64.json*", (route) =>
    route.fulfill({ json: "invalid base64!" }),
  );
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(
    "The combo snapshot could not be loaded, so only the built-in combo list is used.",
  );
  await expect(page.getByRole("button", { name: "Chart Deck", exact: true })).toBeEnabled();
  await expectViewDeck(page, "1 Sol Ring", ["Sol Ring"]);
});
