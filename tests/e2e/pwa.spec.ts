import { test, expect } from "./pwa-server";

test.use({ serviceWorkers: "allow" });
test.setTimeout(120_000);

test("second visit charts offline without caching workers or cloud requests", async ({
  page,
  context,
  deployment,
}) => {
  await page.goto("/PodMates/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await caches.open("pm-datasets"))
          .keys()
          .then((keys) => keys.some((key) => new URL(key.url).pathname.endsWith("/cards.json"))),
      ),
    )
    .toBe(true);
  const firstBoot = deployment.transfers.reduce((sum, transfer) => sum + transfer.bytes, 0);
  await page.locator("#decklistInput").fill("1 Sol Ring\n1 Arcane Signet\n4 Forest");
  await page.getByRole("button", { name: "Chart Deck", exact: true }).click();
  await expect(page.locator("#status")).toContainText("Charted 6 cards");
  await expect(page.locator("#chartArea svg polygon.deck-shape")).toBeVisible();
  // Wait for chart-only runtime cache writes before taking the connection away.
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await caches.open("pm-datasets"))
          .keys()
          .then((keys) =>
            keys.some((key) => new URL(key.url).pathname.endsWith("/TRY_A_DECK_METADATA.json")),
          ),
      ),
    )
    .toBe(true);
  const first = deployment.transfers.reduce((sum, transfer) => sum + transfer.bytes, 0);
  deployment.transfers.length = 0;
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  // Browser SW update checks can bypass Playwright's page-level offline emulation.
  deployment.disconnect();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  await page.locator("#decklistInput").fill("1 Sol Ring\n1 Arcane Signet\n4 Forest");
  await page.getByRole("button", { name: "Chart Deck", exact: true }).click();
  await expect(page.locator("#status")).toContainText("Charted 6 cards");
  await expect(page.locator("#chartArea svg polygon.deck-shape")).toBeVisible();
  expect(workers).toEqual([]);
  const cached = await page.evaluate(async () => {
    const keys = await Promise.all(
      (await caches.keys()).map(async (name) =>
        (await (await caches.open(name)).keys()).map((key) => key.url),
      ),
    );
    return keys.flat();
  });
  expect(cached.some((url) => /db\.worker-|firestore|googleapis|workers\.dev/.test(url))).toBe(
    false,
  );
  expect(deployment.transfers).toEqual([]);
  console.log(
    `PWA transfer: first boot ${firstBoot}; first visit + chart ${first} gzip body bytes; offline repeat 0 bytes`,
  );
});

test("code update downloads changed chunks, keeps data, and waits for Reload", async ({
  page,
  deployment,
}) => {
  await page.goto("/PodMates/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  const before = await page.evaluate(() => performance.timeOrigin);
  await deployment.update();
  deployment.transfers.length = 0;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  await expect(page.locator("#pmUpdate")).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(before);
  const changed = deployment.transfers.filter((transfer) => transfer.status === 200);
  const chunks = changed.filter(
    (transfer) => transfer.path.includes("/assets/") && transfer.path.endsWith(".js"),
  );
  expect(chunks).toHaveLength(1);
  expect(chunks[0].path).toMatch(/\/main-[\w-]+\.js$/);
  expect(changed.some((transfer) => transfer.path.includes("/data/"))).toBe(false);
  expect(changed.some((transfer) => transfer.path.endsWith(".css"))).toBe(false);
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    page.locator("#pmUpdate").getByRole("button", { name: "Reload", exact: true }).click(),
  ]);
  expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(before);
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  expect(
    deployment.transfers.filter(
      (transfer) => transfer.path.includes("/data/") && transfer.bytes > 0,
    ),
  ).toEqual([]);
  console.log(
    `PWA update transfer: ${changed.reduce((sum, transfer) => sum + transfer.bytes, 0)} gzip body bytes; changed JS ${chunks[0].bytes}; unchanged dataset bodies 0`,
  );
});

test("a weekly dataset changes its cache key without a code deployment", async ({
  page,
  deployment,
}) => {
  await page.goto("/PodMates/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  const tagsKeys = () =>
    page.evaluate(async () =>
      (await (await caches.open("pm-datasets")).keys())
        .filter((key) => new URL(key.url).pathname.endsWith("/tags.json"))
        .map((key) => key.url),
    );
  await expect.poll(tagsKeys).toHaveLength(1);
  const [old] = await tagsKeys();
  await deployment.updateDataset();
  deployment.transfers.length = 0;
  await page.reload();
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  await expect.poll(tagsKeys).toHaveLength(2);
  expect((await tagsKeys()).find((key) => key !== old)).toMatch(/\?v=[a-f0-9]{64}$/);
  const changed = deployment.transfers.filter(
    (transfer) => transfer.bytes > 0 && transfer.path.includes("/data/"),
  );
  expect(changed.map((transfer) => transfer.path).sort()).toEqual([
    "/PodMates/data/manifest.json",
    "/PodMates/data/tags.json",
  ]);
});

test("emergency SW replacement unregisters and clears only app caches without reloading", async ({
  page,
  deployment,
}) => {
  await page.goto("/PodMates/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  await page.evaluate(async () => {
    await (await caches.open("unrelated-app")).put("/unrelated", new Response("keep"));
  });
  const before = await page.evaluate(() => performance.timeOrigin);
  await deployment.killSwitch();
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  await expect
    .poll(() =>
      page.evaluate(async () => (await navigator.serviceWorker.getRegistration()) === undefined),
    )
    .toBe(true);
  expect(await page.evaluate(() => caches.keys())).toEqual(["unrelated-app"]);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(before);
});
