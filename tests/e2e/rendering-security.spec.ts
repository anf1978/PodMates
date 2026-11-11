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
      body: "window.Tesseract = { fixture: true };",
    }),
  );
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  expect(
    await page.evaluate(`(async () => {
    const responses = await Promise.all([
      fetch('https://spring-unit-49d9.anthony-ef7.workers.dev/?deckUrl=test'),
      fetch('https://raw.githubusercontent.com/anf1978/PodMates/pricescry-data/radar.json')
    ]);
    await loadTesseractScript();
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

test("an invite URL can be cancelled and requires consent before sharing decks", async ({
  page,
}) => {
  await page.goto("/?join=ATTACKER-CODE");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  // Keep the real confirmation UI, but never authenticate or write to Firestore.
  await page.evaluate(`(() => {
    updateAuthBar = () => {};
    refreshCloudDecksCache = async () => {};
    refreshCloudChroniclesCache = async () => {};
    window.PodmatesCloud.onAuthChange = callback => callback({ uid: 'victim', isAnonymous: false });
    window.PodmatesCloud.joinPodByInviteCode = async () => {
      document.body.dataset.joined = 'yes';
      return { ok: false, error: 'Test join finished' };
    };
    wireCloudAuth();
  })();`);
  await expect(
    page.getByText(/members will be able to see your non-secret saved decks/),
  ).toBeVisible();
  await expect(page.locator("body")).not.toHaveAttribute("data-joined");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("body")).not.toHaveAttribute("data-joined");
  await page.evaluate("pendingJoinCode = 'ATTACKER-CODE'; wireCloudAuth();");
  await page.getByRole("button", { name: "Join pod", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-joined", "yes");
});
