import { test, expect } from "./offline";

test("CSP permits import/price connections, OCR scripts, blob workers and Wasm", async ({
  page,
}) => {
  for (const url of [
    "https://spring-unit-49d9.anthony-ef7.workers.dev/?deckUrl=test",
    "https://raw.githubusercontent.com/anf1978/PodMates/pricescry-data/radar.json",
  ]) {
    await page.route(url, (route) =>
      route.fulfill({
        json: { fixture: true },
        headers: { "Access-Control-Allow-Origin": "*" },
      }),
    );
  }
  await page.route("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.Tesseract = { fixture: true, recognize: async () => ({ data: { text: '' } }) };",
    }),
  );
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await page.locator("#openDeckBuilderBtn").click();
  await page.locator("#dbScanBtn").click();
  await page.locator("#scanCardsFileInput").setInputFiles({
    name: "cards.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator("#scanCardsStatus")).toContainText("Done");
  expect(
    await page.evaluate(`(async () => {
    const responses = await Promise.all([
      fetch('https://spring-unit-49d9.anthony-ef7.workers.dev/?deckUrl=test'),
      fetch('https://raw.githubusercontent.com/anf1978/PodMates/pricescry-data/radar.json')
    ]);
    await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
    await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob(['postMessage("ready")'], { type: 'text/javascript' }));
      const worker = new Worker(url);
      worker.onmessage = () => { worker.terminate(); URL.revokeObjectURL(url); resolve(); };
      worker.onerror = error => { worker.terminate(); URL.revokeObjectURL(url); reject(error.message); };
    });
    return responses.every(response => response.ok) && window.Tesseract.fixture;
  })()`),
  ).toBe(true);
});

test("legacy sanitizer rejects executable markup independently of CSP", async ({ page }) => {
  // Isolate the sanitizer: CSP must not mask a sanitizer regression. Chromium also
  // reports handlers compiled while DOMPurify parses its detached, inert document.
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      /<meta http-equiv="Content-Security-Policy"[^>]*>/,
      "",
    );
    await route.fulfill({ response, body: html });
  });
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.evaluate(`setDbLoadUI('ok',
    '<strong>Deck &amp; pod notes</strong><img onerror="alert(1)">' +
    '<a href="javascript:alert(1)">unsafe</a><a href="https://scryfall.com">safe</a>' +
    '<svg onload="alert(1)"><circle cx="10" cy="10" r="5"/></svg>');`);
  const status = page.locator("#dbStatus");
  await expect(status.locator("strong")).toHaveText("Deck & pod notes");
  await expect(status.locator("[onerror], [onload], script")).toHaveCount(0);
  await expect(status.getByText("unsafe", { exact: true })).not.toHaveAttribute("href");
  await expect(status.getByText("safe", { exact: true })).toHaveAttribute(
    "href",
    "https://scryfall.com",
  );
  await expect(status.locator("svg circle")).toHaveCount(1);
  expect(dialogs).toEqual([]);
});

test("an invite URL can be dismissed before authentication or sharing decks", async ({ page }) => {
  await page.goto("/?join=ATTACKER-CODE");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#podmatesToast")).toContainText(
    "Sign in or create an account to join this pod.",
  );
  await expect(page.locator("#authSubmitBtn")).toHaveText("Create Account");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Signed-in consent/acceptance lives in the pod lifecycle tests, using repository mocks
  // rather than patching the retired inline wireCloudAuth/pendingJoinCode implementation.
});
