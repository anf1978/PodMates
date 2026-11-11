import { test, expect } from "./offline";

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
    expect(
      await page.evaluate(`(() => {
      const card = CARD_DB.find(c => c.n.includes(' // '));
      const [front, back] = card.n.split(' // ').map(n => n.trim().toLowerCase());
      return window.__dbReady && typeof window.buildLookupIndexes === 'function' &&
        CARD_DB_COMPRESSED_B64.length > 0 &&
        indexes.byExactName.get(card.n.toLowerCase()) === card &&
        indexes.byFrontFaceName.get(front) === card &&
        indexes.byBackFaceName.get(back) === card;
    })()`),
    ).toBe(true);
  });
}
