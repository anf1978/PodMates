import { readFileSync } from "node:fs";
import { test, expect } from "./offline";

test("first load reports transfer size and leaves optional feature data deferred", async ({
  page,
  context,
  baseURL,
}) => {
  const requests: string[] = [];
  const responses: Promise<{ url: string; transferBytes: number; bodyBytes: number }>[] = [];
  context.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/data/")) requests.push(request.url());
  });
  context.on("response", (response) => {
    if (new URL(response.url()).origin !== new URL(baseURL!).origin) return;
    responses.push(
      (async () => {
        await response.finished();
        const sizes = await response.request().sizes();
        return {
          url: response.url(),
          transferBytes: sizes.responseBodySize + sizes.responseHeadersSize,
          bodyBytes: sizes.responseBodySize,
        };
      })(),
    );
  });
  const manifestResponse = page.waitForResponse("**/data/manifest.json");
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  await page.waitForLoadState("networkidle");
  const local = await Promise.all(responses);
  const transfer = {
    transferBytes: local.reduce((total, response) => total + response.transferBytes, 0),
    bodyBytes: local.reduce((total, response) => total + response.bodyBytes, 0),
    datasets: local
      .filter((response) => new URL(response.url).pathname.includes("/data/"))
      .map((response) => new URL(response.url).pathname.split("/").pop()),
  };
  console.log("First-load transfer:", JSON.stringify(transfer));
  await test.info().attach("first-load-transfer.json", {
    body: JSON.stringify(transfer, null, 2),
    contentType: "application/json",
  });
  for (const name of [
    "TRY_A_DECK_OPTIONS",
    "TRY_A_DECK_METADATA",
    "PRECON_FINGERPRINTS",
    "KNOW_JSON",
    "IMPACT_CANDS",
  ]) {
    expect(transfer.datasets).not.toContain(`${name}.json`);
  }
  const manifest = (await (await manifestResponse).json()) as {
    files: Record<string, { sha256: string }>;
  };
  for (const request of requests) {
    const url = new URL(request);
    const name = url.pathname.split("/").pop()!;
    if (name !== "manifest.json")
      expect(url.searchParams.get("v")).toBe(manifest.files[name].sha256);
  }
});

test("pasted analysis loads only fingerprints/metadata; suggestions load knowledge on open", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(new URL(request.url()).pathname));
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/data/KNOW_JSON.json*", async (route) => {
    await pending;
    await route.continue();
  });
  const decks = JSON.parse(
    readFileSync(new URL("../../public/data/TRY_A_DECK_OPTIONS.json", import.meta.url), "utf8"),
  ) as { key: string; decklist: string; commander: string }[];
  const sample = decks.find((deck) => deck.key === "uril")!;
  try {
    await page.goto("/");
    await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
    await page.locator("#decklistInput").fill(sample.decklist);
    await page.locator("#commanderInput").fill(sample.commander);
    await page.getByRole("button", { name: "Chart Deck", exact: true }).click();
    await expect(page.locator("#status")).toContainText(/^Charted /);
    await expect(page.locator("#archetypeMatchCallout")).toContainText("Voltron");
    expect(requested).toContain("/data/PRECON_FINGERPRINTS.json");
    expect(requested).toContain("/data/TRY_A_DECK_METADATA.json");
    for (const name of ["TRY_A_DECK_OPTIONS", "KNOW_JSON", "IMPACT_CANDS"]) {
      expect(requested).not.toContain(`/data/${name}.json`);
    }

    const synergy = page.locator("#synergyPanel > details");
    if ((await synergy.getAttribute("open")) === null) {
      await synergy.locator(":scope > summary").click();
    }
    await page.getByRole("button", { name: /Cards you could add/ }).click();
    await expect(page.locator("#tadOverlay .tad-modal")).toContainText("Loading...");
    release();
    // The loading dialog shares this name (it is labelled by the same heading), so wait for the
    // suggestions sheet itself, which is only built after the knowledge data has loaded.
    const suggestions = page
      .locator("#ixSugOverlay")
      .getByRole("dialog", { name: "Cards you could add" });
    await expect(suggestions).toBeVisible();
    expect(await page.evaluate("KNOW_MAP.size")).toBeGreaterThan(0);
    await page.locator("#ixSugClose").click();
    await page.getByRole("button", { name: /Cards you could add/ }).click();
    await expect(suggestions).toBeVisible();
    expect(requested.filter((path) => path === "/data/KNOW_JSON.json")).toHaveLength(1);
  } finally {
    release();
  }
});

test("Impact and sample-table entry points await their data without boot-time reads", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(new URL(request.url()).pathname));
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  const decks = JSON.parse(
    readFileSync(new URL("../../public/data/TRY_A_DECK_OPTIONS.json", import.meta.url), "utf8"),
  ) as { key: string; decklist: string; commander: string }[];
  const sample = decks.find((deck) => deck.key === "uril")!;
  await page.locator("#decklistInput").fill(sample.decklist);
  await page.locator("#commanderInput").fill(sample.commander);
  await page.getByRole("button", { name: "Chart Deck", exact: true }).click();
  await expect(page.locator("#status")).toContainText(/^Charted /);
  expect(requested).not.toContain("/data/IMPACT_CANDS.json");
  await page.locator("#impactCardsBtn").click();
  await expect(page.locator("#impactBody")).not.toContainText("Loading");
  await expect(page.locator("[data-impact-more]")).toBeVisible();
  expect(requested.filter((path) => path === "/data/IMPACT_CANDS.json")).toHaveLength(1);
  // Rankings come from the loaded library (src/cards/search.ts cardPopularity).
  expect(await page.evaluate("TRY_A_DECK_OPTIONS.length")).toBeGreaterThan(0);
  await page.evaluate("loadAnalysisDatasets()");
  expect(await page.evaluate("TRY_A_DECK_METADATA.map(deck => deck.key)")).toEqual(
    await page.evaluate("TRY_A_DECK_OPTIONS.map(deck => deck.key)"),
  );
  await page.reload();
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  expect(await page.evaluate("typeof TRY_A_DECK_OPTIONS")).toBe("undefined");
  // Isolate this entry-point check from the pre-existing pod SVG height="auto" errors.
  await page.evaluate(
    "renderPodAnalysisResults = decks => { window.__sampleDeckCount = decks.length; }; runSampleGathering()",
  );
  expect(await page.evaluate("window.__sampleDeckCount")).toBe(6);
});

test("card search waits for library rankings and discards a superseded query", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/data/TRY_A_DECK_OPTIONS.json*", async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto("/");
    await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
    await page.locator("#openDeckBuilderBtn").click();
    await page.locator("#dbCardSearch").fill("Sol");
    await expect(page.locator("#dbCardResults")).toContainText("Loading...");
    await page.locator("#dbCardSearch").fill("Arcane");
    release();
    await expect(page.locator("#dbCardResults")).toContainText("Arcane Signet");
    await expect(page.locator("#dbCardResults")).not.toContainText("Sol Ring");
    // Rankings come from the loaded library (src/cards/search.ts cardPopularity).
    expect(await page.evaluate("TRY_A_DECK_OPTIONS.length")).toBeGreaterThan(0);
  } finally {
    release();
  }
});

test("stale cards show a subtle footer warning and a console warning", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  const generatedAt = new Date(Date.now() - 15 * 86_400_000).toISOString();
  await page.route("**/data/manifest.json", async (route) => {
    const response = await route.fetch();
    const manifest = await response.json();
    manifest.files["cards.json"].generatedAt = generatedAt;
    await route.fulfill({ json: manifest });
  });
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await expect(page.locator("#dataFreshness")).toContainText(
    `Card data as of ${generatedAt.slice(0, 10)}`,
  );
  await expect(page.locator("#dataFreshness")).toContainText("Card data is over 14 days old");
  expect(warnings).toContain(`PodMates: card data is over 14 days old (${generatedAt}).`);
});
