import { test, expect } from "./offline";

test("pod chronicles stay readable as a guest and clearing opens optional sign-in", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#modePodBtn").click();
  await page.getByText("Chronicles & Stories", { exact: true }).click();
  await expect(page.locator("#matchLogArea")).toContainText("No chapters yet");
  await page.locator("#clearMatchHistoryBtn").click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Create an Account");
  await page.keyboard.press("Escape");
  await expect(page.locator("#clearMatchHistoryBtn")).toBeFocused();
});

test("battle controls confirm logging and keep post-battle choices host-only", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dbStatus")).toContainText(/^Ready /);
  // Feed the existing comparison handoff without authenticating or writing to Firestore.
  await page.evaluate(`(() => {
    currentBattleContext = { podId: 'fixture-pod', gatheringId: 'fixture-battle',
      isHost: true, participants: [] };
    document.getElementById('podResultsSection').style.display = 'block';
    renderBattleControls();
  })()`);
  await page.getByRole("button", { name: "Log Battle", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("This can’t be undone.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#logBattleBtn")).toBeFocused();
  await page.evaluate(`currentBattleContext.loggedChronicleId = 'logged'; renderBattleControls();`);
  await expect(page.locator("#repeatBattleBtn")).toBeVisible();
  await expect(page.locator("#startNewBattleBtn")).toBeVisible();
  await page.evaluate(`currentBattleContext.isHost = false; renderBattleControls();`);
  await expect(page.locator("#battleControlsArea")).toContainText("thanks for playing");
  await expect(page.locator("#repeatBattleBtn")).toHaveCount(0);
});
