import { test, expect } from "./offline";

test("Deck Crafter restores drafts, edits quantities and charts the deck", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  await page.locator("#openDeckBuilderBtn").click();
  await expect(page.getByRole("heading", { name: "Deck Crafter", exact: true })).toBeVisible();
  if (process.env.PM_CRAFTER_SCREENSHOTS) {
    await page.screenshot({ path: `${process.env.PM_CRAFTER_SCREENSHOTS}\\empty.png` });
  }
  await page.locator("#dbPlayerInput").fill("Alex");
  await page.locator("#dbCommanderSearch").fill("Tymna the Weaver");
  await page.locator("#dbCommanderResults [data-pm-card='Tymna the Weaver']").click();
  await page.locator("#dbAddPartnerBtn").click();
  await page.locator("#dbCommanderSearch").fill("Kraum, Ludevic's Opus");
  await page.locator('#dbCommanderResults [data-pm-card="Kraum, Ludevic\'s Opus"]').click();
  await page.locator("#dbCardSearch").fill("Sol Ring");
  await page.locator("#dbCardResults [data-pm-card='Sol Ring']").click();
  await page.locator("[data-qty-for='Sol Ring']").fill("2");
  await page.locator("[data-qty-for='Sol Ring']").dispatchEvent("change");
  await expect(page.locator("#dbCardCount")).toHaveText("4");
  // Let the transient search confirmation disappear before visual comparison.
  await expect(page.locator("#dbCardResults")).toBeEmpty();
  await expect(page.locator("#dbCommanderResults")).toBeEmpty();
  if (process.env.PM_CRAFTER_SCREENSHOTS) {
    await page.screenshot({ path: `${process.env.PM_CRAFTER_SCREENSHOTS}\\populated.png` });
  }
  await page.locator("#tadCloseBtn").click();
  await page.reload();
  await expect(page.locator("#dbStatus")).toContainText(/^Ready .* cards.*loaded/);
  await page.locator("#openDeckBuilderBtn").click();
  await expect(page.locator("#dbDraftNotice")).toContainText("Picked up where you left off");
  await expect(page.locator("#dbPlayerInput")).toHaveValue("Alex");
  await expect(page.locator("[data-qty-for='Sol Ring']")).toHaveValue("2");
  await page.locator("#dbChartBtn").click();
  await expect(page.locator("#decklistInput")).toHaveValue(
    "1 Tymna the Weaver\n1 Kraum, Ludevic's Opus\n2 Sol Ring",
  );
  await expect(page.locator("#commanderInput")).toHaveValue(
    "Tymna the Weaver / Kraum, Ludevic's Opus",
  );
  await expect(page.locator("#status")).toContainText("Charted 4 cards (3 unique)");
});

test("drafts win until Load Current or Start New is explicitly chosen", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await page.evaluate(() =>
    localStorage.setItem(
      "podmates-deck-builder-draft",
      JSON.stringify({
        cards: { Island: 3 },
        commander: "Talrand, Sky Summoner",
        player: "Sam",
      }),
    ),
  );
  await page.locator("#decklistInput").fill("2 Forest");
  await page.locator("#commanderInput").fill("Omnath, Locus of Mana");
  await page.locator("#playerInput").fill("Alex");
  await page.locator("#openDeckBuilderBtn").click();
  await expect(page.locator("#dbCommanderDisplay")).toContainText("Talrand");
  await page.locator("#dbLoadCurrentBtn").click();
  await expect(page.locator("#dbCommanderDisplay")).toContainText("Omnath");
  await expect(page.locator("#dbPlayerInput")).toHaveValue("Alex");
  await expect(page.locator("[data-qty-for='Forest']")).toHaveValue("2");
  await expect(page.locator("#dbDraftNotice")).toHaveCount(0);
  await page.locator("#tadCloseBtn").click();
  await page.locator("#openDeckBuilderBtn").click();
  await page.locator("#dbStartNewBtn").click();
  await page.locator("#actionConfirmCancelBtn").click();
  await expect(page.locator("#dbCommanderDisplay")).toContainText("Omnath");
  await page.locator("#dbStartNewBtn").click();
  await page.locator("#actionConfirmOkBtn").click();
  await expect(page.locator("#dbCardCount")).toHaveText("0");
  await expect(page.locator("#dbCommanderDisplay")).toHaveText("No commander set yet");
  await expect(page.locator("#decklistInput")).toHaveValue("2 Forest");
});

test("identity filtering can be disabled and Save preserves the current deck name", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  await page.locator("#decklistInput").fill("1 Sol Ring");
  await page.locator("#commanderInput").fill("Talrand, Sky Summoner");
  await page.locator("#playerInput").fill("Alex");
  await page.locator("#deckNameInput").fill("My custom name");
  await page.locator("#openDeckBuilderBtn").click();
  await page.locator("#dbCardSearch").fill("Lightning Bolt");
  await expect(page.locator("#dbCardResults .pm-sr-note")).toBeVisible();
  await expect(page.locator("#dbCardResults [data-pm-card='Lightning Bolt']")).toHaveCount(0);
  await page.locator("#dbIdentityToggle").uncheck();
  await page.locator("#dbCardResults [data-pm-card='Lightning Bolt']").click();
  await expect(
    page.locator('#dbDeckList [title="Outside Talrand, Sky Summoner\'s color identity"]'),
  ).toHaveCount(1);
  await page.locator("#dbSaveBtn").click();
  await expect(page.locator("#deckNameInput")).toHaveValue("My custom name");
  await expect(page.locator("#decklistInput")).toHaveValue(
    "1 Sol Ring\n1 Talrand, Sky Summoner\n1 Lightning Bolt",
  );
  expect(await page.evaluate(() => localStorage.getItem("podmates-deck-builder-draft"))).toBeNull();
  // Signed-out Save still hands off to the existing account gate, without making cloud writes.
  await expect(page.getByRole("dialog")).toBeVisible();
});
